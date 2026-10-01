import { InventoryMode, InventoryStatus, type Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { logger } from '../../lib/logger';
import { formatServiceDate, minutesFromNow, toServiceDate } from '../../utils/date';
import { AppError } from '../../utils/errors';
import { generateToken } from '../../utils/ids';

/**
 * ---------------------------------------------------------------------------
 * Inventory engine
 * ---------------------------------------------------------------------------
 *
 * Inventory lives in `InventoryRecord`, keyed by
 * (ticketType, serviceDate, timeSlot) with three counters:
 *
 *   capacityTotal  configured sellable units
 *   capacityHeld   units reserved by live carts/checkouts
 *   capacitySold   units consumed by confirmed orders
 *
 * Sellable = total - held - sold. Every mutation uses an optimistic
 * `version` guard inside a conditional update, so two concurrent checkouts
 * can never oversell the same seat. Holds are short lived (INVENTORY_HOLD_MINUTES)
 * and a reaper releases expired ones.
 */

export const TIME_SLOTS = [
  '00:00', '06:00', '08:00', '09:00', '10:00', '11:00', '12:00',
  '13:00', '14:00', '15:00', '16:00', '17:00', '18:00', '19:00', '20:00', '22:00',
] as const;

export type HoldRequest = {
  ticketTypeId: string;
  userId?: string | null;
  cartId?: string | null;
  serviceDate: Date;
  timeSlot?: string | null;
  quantity: number;
};

export type HoldResult = {
  holdToken: string;
  inventoryRecordId: string;
  expiresAt: Date;
  quantity: number;
};

/** Makes sure an inventory row exists for the requested slot, creating it lazily. */
export async function ensureInventoryRecord(params: {
  ticketTypeId: string;
  serviceDate: Date;
  timeSlot?: string | null;
  defaultCapacity?: number;
}): Promise<InventoryRow> {
  const { ticketTypeId, serviceDate, timeSlot: rawSlot, defaultCapacity = 50 } = params;
  // Prisma cannot express a nullable field inside a composite unique key, so
  // "no time slot" is stored as the empty string rather than NULL.
  const timeSlot = rawSlot ?? '';

  const existing = await prisma.inventoryRecord.findUnique({
    where: { ticketTypeId_serviceDate_timeSlot: { ticketTypeId, serviceDate, timeSlot } },
  });
  if (existing) return existing;

  try {
    return await prisma.inventoryRecord.create({
      data: {
        ticketTypeId,
        serviceDate,
        timeSlot,
        capacityTotal: defaultCapacity,
        status: InventoryStatus.OPEN,
      },
    });
  } catch (error) {
    // Concurrent creation: re-read the winner's row.
    const raced = await prisma.inventoryRecord.findUnique({
      where: { ticketTypeId_serviceDate_timeSlot: { ticketTypeId, serviceDate, timeSlot } },
    });
    if (raced) return raced;
    throw error;
  }
}

/** Returns how many units are sellable right now. */
export function sellable(record: {
  capacityTotal: number;
  capacityHeld: number;
  capacitySold: number;
  status: InventoryStatus;
  inventoryMode: InventoryMode;
}): number {
  if (record.inventoryMode === InventoryMode.UNLIMITED) return Number.MAX_SAFE_INTEGER;
  if (record.status === InventoryStatus.CLOSED || record.status === InventoryStatus.SOLD_OUT) return 0;
  return Math.max(0, record.capacityTotal - record.capacityHeld - record.capacitySold);
}

type InventoryRow = {
  id: string;
  capacityTotal: number;
  capacityHeld: number;
  capacitySold: number;
  status: InventoryStatus;
  version: number;
};

type InventoryWithMode = {
  capacityTotal: number;
  capacityHeld: number;
  capacitySold: number;
  status: InventoryStatus;
  inventoryMode: InventoryMode;
};

/** Atomically places a hold on inventory. Throws when unavailable. */
export async function placeHold(request: HoldRequest): Promise<HoldResult> {
  const { ticketTypeId, serviceDate, quantity, userId = null, cartId = null } = request;
  const timeSlot = request.timeSlot ?? '';
  if (quantity <= 0) throw AppError.badRequest('Hold quantity must be positive');

  const record = await ensureInventoryRecord({ ticketTypeId, serviceDate, timeSlot });
  const inventoryMode = await resolveInventoryMode(ticketTypeId);

  const available = sellable({ ...record, inventoryMode });
  if (available < quantity) {
    throw AppError.inventoryUnavailable(
      available === 0
        ? 'This date is sold out'
        : `Only ${available} spot${available === 1 ? '' : 's'} left on this date`,
      { available, requested: quantity },
    );
  }

  const updated = await prisma.$transaction(async (tx) => {
    // Optimistic guard: only update when nobody else changed the counters.
    const result = await tx.inventoryRecord.updateMany({
      where: {
        id: record.id,
        version: record.version,
        status: InventoryStatus.OPEN,
        capacityHeld: { lt: record.capacityTotal },
      },
      data: {
        capacityHeld: { increment: quantity },
        version: { increment: 1 },
      },
    });
    if (result.count === 0) {
      // Someone else took the last seats between our read and write.
      throw AppError.inventoryUnavailable('This option just sold out, please pick another');
    }

    const expiresAt = minutesFromNow(15);
    const hold = await tx.inventoryHold.create({
      data: {
        holdToken: generateToken(18),
        inventoryRecordId: record.id,
        cartId,
        userId,
        quantity,
        expiresAt,
        status: 'ACTIVE',
      },
    });

    return hold;
  });

  logger.info('inventory.hold', {
    holdToken: updated.holdToken,
    ticketTypeId,
    quantity,
    expiresAt: updated.expiresAt.toISOString(),
  });

  return {
    holdToken: updated.holdToken,
    inventoryRecordId: record.id,
    expiresAt: updated.expiresAt,
    quantity: updated.quantity,
  };
}

async function resolveInventoryMode(ticketTypeId: string): Promise<InventoryMode> {
  const ticketType = await prisma.ticketType.findUnique({
    where: { id: ticketTypeId },
    select: { inventoryMode: true },
  });
  return ticketType?.inventoryMode ?? InventoryMode.PER_DATE;
}

/** Releases a hold and returns its units to the pool. Idempotent. */
export async function releaseHold(holdToken: string): Promise<void> {
  const hold = await prisma.inventoryHold.findUnique({ where: { holdToken } });
  if (!hold || hold.status !== 'ACTIVE') return;

  await prisma.$transaction(async (tx) => {
    const claimed = await tx.inventoryHold.updateMany({
      where: { id: hold.id, status: 'ACTIVE' },
      data: { status: 'RELEASED', releasedAt: new Date() },
    });
    // Only the transition that actually flipped ACTIVE -> RELEASED decrements.
    if (claimed.count === 1) {
      await tx.inventoryRecord.update({
        where: { id: hold.inventoryRecordId },
        data: {
          capacityHeld: { decrement: hold.quantity },
          version: { increment: 1 },
        },
      });
    }
  });

  logger.info('inventory.release', { holdToken, quantity: hold.quantity });
}

/** Converts a hold into a sale: held -> sold. Called after payment capture. */
export async function consumeHold(holdToken: string): Promise<void> {
  const hold = await prisma.inventoryHold.findUnique({ where: { holdToken } });
  if (!hold) throw AppError.inventoryExpired('Hold not found');
  if (hold.status === 'CONSUMED') return; // idempotent
  if (hold.status !== 'ACTIVE') throw AppError.inventoryExpired('Hold is no longer active');

  await prisma.$transaction(async (tx) => {
    const claimed = await tx.inventoryHold.updateMany({
      where: { id: hold.id, status: 'ACTIVE' },
      data: { status: 'CONSUMED', releasedAt: new Date() },
    });
    if (claimed.count === 1) {
      // Move the units from `held` to `sold` in a single statement so the
      // sellable count never transiently changes.
      await tx.$executeRaw`
        UPDATE "InventoryRecord"
        SET "capacityHeld" = "capacityHeld" - ${hold.quantity},
            "capacitySold" = "capacitySold" + ${hold.quantity},
            "version" = "version" + 1,
            "updatedAt" = NOW()
        WHERE id = ${hold.inventoryRecordId}
      `;
    }
  });

  logger.info('inventory.consume', { holdToken, quantity: hold.quantity });
}

/**
 * Sweeps holds whose TTL elapsed. Called on a timer and opportunistically
 * before availability queries, so abandoned carts release their seats.
 */
export async function releaseExpiredHolds(limit = 200): Promise<number> {
  const expired = await prisma.inventoryHold.findMany({
    where: { status: 'ACTIVE', expiresAt: { lt: new Date() } },
    select: { id: true, holdToken: true, quantity: true, inventoryRecordId: true },
    take: limit,
  });

  let released = 0;
  for (const hold of expired) {
    await prisma.$transaction(async (tx) => {
      const claimed = await tx.inventoryHold.updateMany({
        where: { id: hold.id, status: 'ACTIVE' },
        data: { status: 'EXPIRED', releasedAt: new Date() },
      });
      if (claimed.count === 1) {
        await tx.inventoryRecord.update({
          where: { id: hold.inventoryRecordId },
          data: {
            capacityHeld: { decrement: hold.quantity },
            version: { increment: 1 },
          },
        });
      }
    });
    released += 1;
  }

  if (released > 0) logger.info('inventory.expiry_sweep', { released });
  return released;
}

/** Cancels a booking and returns sold units back to the pool. */
export async function returnSoldUnits(
  tx: Prisma.TransactionClient,
  ticketTypeId: string,
  serviceDate: Date,
  timeSlot: string | null,
  quantity: number,
): Promise<void> {
  const slot = timeSlot ?? '';
  const record = await tx.inventoryRecord.findUnique({
    where: { ticketTypeId_serviceDate_timeSlot: { ticketTypeId, serviceDate, timeSlot: slot } },
  });
  if (!record) return;

  await tx.inventoryRecord.update({
    where: { id: record.id },
    data: {
      capacitySold: { decrement: quantity },
      version: { increment: 1 },
    },
  });

  // Recompute status so a sold-out day reopens once capacity frees up.
  const remaining = record.capacityTotal - record.capacityHeld - (record.capacitySold - quantity);
  if (remaining > 0 && record.status === InventoryStatus.SOLD_OUT) {
    await tx.inventoryRecord.update({
      where: { id: record.id },
      data: { status: InventoryStatus.OPEN },
    });
  }
}

/** Rolls a day to SOLD_OUT once no capacity remains. */
export async function markSoldOutIfEmpty(
  tx: Prisma.TransactionClient,
  inventoryRecordId: string,
): Promise<void> {
  const record = await tx.inventoryRecord.findUnique({ where: { id: inventoryRecordId } });
  if (!record) return;
  if (record.capacityTotal - record.capacityHeld - record.capacitySold <= 0) {
    await tx.inventoryRecord.update({
      where: { id: inventoryRecordId },
      data: { status: InventoryStatus.SOLD_OUT },
    });
  }
}

/**
 * Availability across a date window, used by the calendar picker on the
 * detail page. Returns a status and the cheapest price per day.
 */
export async function getAvailabilityCalendar(params: {
  productId: string;
  from: Date;
  to: Date;
}): Promise<{ date: string; status: string; availableQty: number; minPriceCents: number }[]> {
  await releaseExpiredHolds(50);

  const ticketTypes = await prisma.ticketType.findMany({
    where: { productId: params.productId, active: true },
    select: { id: true, basePriceCents: true, inventoryMode: true },
  });
  if (ticketTypes.length === 0) return [];

  const records = await prisma.inventoryRecord.findMany({
    where: {
      ticketTypeId: { in: ticketTypes.map((t) => t.id) },
      serviceDate: { gte: params.from, lte: params.to },
    },
  });

  const priceByType = new Map(ticketTypes.map((t) => [t.id, t.basePriceCents]));
  const byDate = new Map<string, { available: number; minPrice: number }>();

  for (const record of records) {
    if (record.status === InventoryStatus.CLOSED) continue;

    const available = sellable({ ...record, inventoryMode: InventoryMode.PER_DATE });
    if (available <= 0) continue;

    const key = formatServiceDate(record.serviceDate);
    const existing = byDate.get(key);
    const price = priceByType.get(record.ticketTypeId) ?? 0;

    if (existing) {
      existing.available += available;
      existing.minPrice = Math.min(existing.minPrice, price);
    } else {
      byDate.set(key, { available, minPrice: price });
    }
  }

  return [...byDate.entries()]
    .map(([date, value]) => ({
      date,
      status: value.available >= 10 ? 'AVAILABLE' : 'LIMITED',
      availableQty: value.available,
      minPriceCents: value.minPrice,
    }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

/** Seeds inventory rows for a window (used by admin tooling and the seeder). */
export async function seedInventoryWindow(params: {
  ticketTypeId: string;
  from: Date;
  to: Date;
  capacity: number;
  timeSlots?: string[];
  netPriceCents?: number;
}): Promise<number> {
  const dates: Date[] = [];
  let cursor = toServiceDate(params.from);
  const end = toServiceDate(params.to);
  while (cursor.getTime() <= end.getTime() && dates.length < 400) {
    dates.push(cursor);
    cursor = new Date(cursor.getTime() + 86_400_000);
  }

  const slots = params.timeSlots && params.timeSlots.length ? params.timeSlots : [''];
  let created = 0;

  for (const date of dates) {
    for (const slot of slots) {
      const data = {
        ticketTypeId: params.ticketTypeId,
        serviceDate: date,
        timeSlot: slot,
        capacityTotal: params.capacity,
        netPriceCents: params.netPriceCents,
        status: InventoryStatus.OPEN,
      };
      const result = await prisma.inventoryRecord.upsert({
        where: { ticketTypeId_serviceDate_timeSlot: { ticketTypeId: params.ticketTypeId, serviceDate: date, timeSlot: slot } },
        create: data,
        update: { capacityTotal: params.capacity, netPriceCents: params.netPriceCents },
      });
      if (result) created += 1;
    }
  }

  return created;
}