import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { config } from '../config/env';
import { prisma } from '../lib/prisma';
import { requireAuth } from '../plugins/auth';
import { AppError } from '../utils/errors';
import { hashPassword, verifyPassword } from '../utils/crypto';
import { signToken } from '../utils/jwt';

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8, 'Use at least 8 characters').max(200),
  firstName: z.string().trim().min(1).max(80),
  lastName: z.string().trim().min(1).max(80),
  phone: z.string().trim().max(40).optional(),
  locale: z.enum(['en-US', 'en-GB', 'fr-FR', 'de-DE', 'es-ES', 'it-IT']).optional(),
  countryCode: z.string().length(2).optional(),
  marketingOptIn: z.boolean().optional(),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export async function authRoutes(app: FastifyInstance): Promise<void> {
  app.post('/auth/register', {}, async (request, reply) => {
    const body = registerSchema.parse(request.body);

    const existing = await prisma.user.findUnique({ where: { email: body.email.toLowerCase() } });
    if (existing) throw AppError.conflict('An account with that email already exists');

    const user = await prisma.user.create({
      data: {
        email: body.email.toLowerCase(),
        passwordHash: hashPassword(body.password),
        firstName: body.firstName,
        lastName: body.lastName,
        phone: body.phone ?? null,
        locale: body.locale ?? config.site.defaultLocale,
        countryCode: body.countryCode?.toUpperCase() ?? null,
        marketingOptIn: body.marketingOptIn ?? false,
        // Every customer gets a loyalty account so earn/redeem works from day one.
        loyaltyAccount: { create: { tier: 'MEMBER' } },
        travelerProfiles: {
          create: { fullName: `${body.firstName} ${body.lastName}`, email: body.email, isDefault: true },
        },
      },
    });

    await prisma.userSession.create({
      data: {
        userId: user.id,
        ip: request.ip,
        userAgent: request.headers['user-agent'],
        expiresAt: new Date(Date.now() + 7 * 86_400_000),
      },
    });

    const token = signToken({ sub: user.id, email: user.email, role: user.role, locale: user.locale });

    return reply.status(201).send({
      token,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        locale: user.locale,
        role: user.role,
      },
    });
  });

  app.post('/auth/login', {}, async (request) => {
    const body = loginSchema.parse(request.body);

    const user = await prisma.user.findUnique({
      where: { email: body.email.toLowerCase() },
      include: { loyaltyAccount: true },
    });

    // Same message for unknown email and wrong password: no account enumeration.
    if (!user || !verifyPassword(body.password, user.passwordHash)) {
      throw AppError.unauthenticated('Incorrect email or password');
    }

    const token = signToken({ sub: user.id, email: user.email, role: user.role, locale: user.locale });

    return {
      token,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        locale: user.locale,
        role: user.role,
        loyalty: user.loyaltyAccount
          ? { tier: user.loyaltyAccount.tier, points: user.loyaltyAccount.points }
          : null,
      },
    };
  });

  app.get('/auth/me', {}, async (request) => {
    const user = requireAuth(request);

    const profile = await prisma.user.findUnique({
      where: { id: user.id },
      include: {
        loyaltyAccount: { include: { transactions: { orderBy: { createdAt: 'desc' }, take: 20 } } },
        travelerProfiles: true,
        _count: { select: { orders: true, reviews: true, wishlist: true } },
      },
    });

    if (!profile) throw AppError.notFound('User');

    return {
      id: profile.id,
      email: profile.email,
      firstName: profile.firstName,
      lastName: profile.lastName,
      phone: profile.phone,
      locale: profile.locale,
      role: profile.role,
      marketingOptIn: profile.marketingOptIn,
      loyalty: profile.loyaltyAccount
        ? {
            tier: profile.loyaltyAccount.tier,
            points: profile.loyaltyAccount.points,
            lifetimePoints: profile.loyaltyAccount.lifetimePoints,
            transactions: profile.loyaltyAccount.transactions.map((t) => ({
              id: t.id,
              kind: t.kind,
              points: t.points,
              note: t.note,
              createdAt: t.createdAt,
            })),
          }
        : null,
      travelers: profile.travelerProfiles.map((t) => ({
        id: t.id,
        fullName: t.fullName,
        email: t.email,
        isDefault: t.isDefault,
      })),
      stats: profile._count,
    };
  });

  app.patch('/auth/me', {}, async (request) => {
    const user = requireAuth(request);
    const body = z
      .object({
        firstName: z.string().trim().min(1).max(80).optional(),
        lastName: z.string().trim().min(1).max(80).optional(),
        phone: z.string().trim().max(40).nullish(),
        locale: z.string().optional(),
        marketingOptIn: z.boolean().optional(),
      })
      .parse(request.body);

    const updated = await prisma.user.update({ where: { id: user.id }, data: body });

    return {
      id: updated.id,
      email: updated.email,
      firstName: updated.firstName,
      lastName: updated.lastName,
      phone: updated.phone,
      locale: updated.locale,
      marketingOptIn: updated.marketingOptIn,
    };
  });

  /** Saved traveller profiles, attached to bookings at checkout. */
  app.post('/auth/travelers', {}, async (request, reply) => {
    const user = requireAuth(request);
    const body = z
      .object({
        fullName: z.string().trim().min(1).max(160),
        email: z.string().email().optional(),
        phone: z.string().trim().max(40).optional(),
        documentType: z.string().max(40).optional(),
        documentNo: z.string().max(60).optional(),
        nationality: z.string().length(2).optional(),
        isDefault: z.boolean().optional(),
      })
      .parse(request.body);

    if (body.isDefault) {
      await prisma.travelerProfile.updateMany({ where: { userId: user.id }, data: { isDefault: false } });
    }

    const traveler = await prisma.travelerProfile.create({
      data: {
        userId: user.id,
        fullName: body.fullName,
        email: body.email ?? null,
        phone: body.phone ?? null,
        documentType: body.documentType ?? null,
        documentNo: body.documentNo ?? null,
        nationality: body.nationality?.toUpperCase() ?? null,
        isDefault: body.isDefault ?? false,
      },
    });

    return reply.status(201).send(traveler);
  });
}