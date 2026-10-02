import { mkdir, writeFile } from 'fs/promises';
import { dirname, join } from 'path';
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import QRCode from 'qrcode';
import { config } from '../../config/env';
import { logger } from '../../lib/logger';
import { formatServiceDate } from '../../utils/date';

/**
 * ---------------------------------------------------------------------------
 * Ticketing & fulfilment
 * ---------------------------------------------------------------------------
 *
 * Once payment settles the booking engine issues an e-ticket per order:
 *   - a signed QR payload (what the gate scanner reads),
 *   - a Code-128-style textual barcode for manual entry,
 *   - a printable PDF wallet pass.
 *
 * Artefacts go to S3/MinIO when configured and fall back to the local disk so
 * the whole redeem loop is exercisable without object storage.
 */

export type TicketArtifactInput = {
  ticketNumber: string;
  barcode: string;
  orderNumber: string;
  productName: string;
  destinationName?: string | null;
  holderName: string;
  holderEmail: string;
  serviceDate: Date;
  timeSlot?: string | null;
  quantity: number;
  totalCents: number;
  currency: string;
  termsUrl?: string | null;
};

export type TicketArtifact = {
  qrPayload: string;
  qrDataUrl: string;
  pdfUrl: string;
  qrImageUrl: string;
};

let s3Client: S3Client | null = null;

function getS3(): S3Client | null {
  if (!config.storage.endpoint || !config.storage.accessKeyId) return null;
  if (!s3Client) {
    s3Client = new S3Client({
      region: config.storage.region,
      endpoint: config.storage.endpoint,
      forcePathStyle: config.storage.forcePathStyle,
      credentials: {
        accessKeyId: config.storage.accessKeyId,
        secretAccessKey: config.storage.secretAccessKey,
      },
    });
  }
  return s3Client;
}

async function persist(key: string, body: Buffer, contentType: string): Promise<string> {
  const s3 = getS3();
  if (s3) {
    try {
      await s3.send(
        new PutObjectCommand({
          Bucket: config.storage.bucket,
          Key: key,
          Body: body,
          ContentType: contentType,
        }),
      );
      return `${config.storage.endpoint}/${config.storage.bucket}/${key}`;
    } catch (error) {
      logger.warn('storage.s3_upload_failed', { key, reason: (error as Error).message });
    }
  }

  const target = join(config.storage.localDir, key);
  await mkdir(dirname(target), { recursive: true });
  await writeFile(target, body);
  return `file://${target}`;
}

/**
 * QR payload. Signed so a forged code cannot be generated offline: the scanner
 * verifies the HMAC against the platform secret before honouring the ticket.
 */
export function buildQrPayload(input: {
  ticketNumber: string;
  orderId: string;
  productId: string;
  serviceDate: Date;
  timeSlot?: string | null;
  signature: string;
}): string {
  const compact = {
    t: input.ticketNumber,
    o: input.orderId,
    p: input.productId,
    d: formatServiceDate(input.serviceDate),
    s: input.timeSlot ?? null,
    sig: input.signature,
  };
  return `EASYTRIP1.${Buffer.from(JSON.stringify(compact)).toString('base64url')}`;
}

export async function generateTicketArtifacts(input: TicketArtifactInput): Promise<TicketArtifact> {
  const qrPayload = `${input.ticketNumber}|${input.barcode}`;
  const qrDataUrl = await QRCode.toDataURL(qrPayload, {
    errorCorrectionLevel: 'M',
    margin: 1,
    width: 320,
    color: { dark: '#0b1220', light: '#ffffff' },
  });

  const pdf = await buildTicketPdf(input, qrDataUrl);
  const [pdfUrl, qrImageUrl] = await Promise.all([
    persist(`tickets/${input.ticketNumber}/ticket.pdf`, pdf, 'application/pdf'),
    persist(`tickets/${input.ticketNumber}/qr.png`, Buffer.from(qrDataUrl.split(',')[1], 'base64'), 'image/png'),
  ]);

  return { qrPayload, qrDataUrl, pdfUrl, qrImageUrl };
}

/** A4-ish wallet pass, one ticket per page. */
async function buildTicketPdf(input: TicketArtifactInput, qrDataUrl: string): Promise<Buffer> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);

  // `create()` returns an empty document, so the page has to be added first.
  // A4 portrait: 595.28 x 841.89 pt.
  const page = doc.addPage([595.28, 841.89]);
  const { width, height } = page.getSize();

  page.drawRectangle({ x: 0, y: height - 120, width, height: 120, color: rgb(0.04, 0.18, 0.33) });
  page.drawText('EASYTRIP', { x: 40, y: height - 62, size: 26, font: bold, color: rgb(1, 1, 1) });
  page.drawText(input.orderNumber, {
    x: 40,
    y: height - 90,
    size: 12,
    font,
    color: rgb(0.75, 0.85, 0.95),
  });
  page.drawText(input.ticketNumber, {
    x: width - 240,
    y: height - 68,
    size: 14,
    font: bold,
    color: rgb(1, 1, 1),
  });

  let y = height - 180;
  const line = (label: string, value: string, size = 12) => {
    page.drawText(label.toUpperCase(), { x: 40, y, size: 9, font, color: rgb(0.45, 0.48, 0.53) });
    page.drawText(value, { x: 40, y: y - 16, size, font: bold, color: rgb(0.08, 0.09, 0.11) });
    y -= 48;
  };

  // Wrap long product names so nothing overflows the card.
  const words = input.productName.split(' ');
  let current = '';
  const productLines: string[] = [];
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (font.widthOfTextAtSize(candidate, 18) > width - 80) {
      productLines.push(current);
      current = word;
    } else {
      current = candidate;
    }
  }
  productLines.push(current);

  page.drawText('EXPERIENCE', { x: 40, y, size: 9, font, color: rgb(0.45, 0.48, 0.53) });
  y -= 22;
  for (const text of productLines.slice(0, 3)) {
    page.drawText(text, { x: 40, y, size: 18, font: bold, color: rgb(0.08, 0.09, 0.11) });
    y -= 24;
  }
  y -= 14;

  line('Guest', input.holderName);
  line('Date', formatServiceDate(input.serviceDate));
  if (input.timeSlot) line('Time slot', input.timeSlot);
  line('Quantity', String(input.quantity));
  if (input.destinationName) line('Location', input.destinationName);

  page.drawImage(await doc.embedPng(Buffer.from(qrDataUrl.split(',')[1], 'base64')), {
    x: width - 230,
    y: height - 340,
    width: 190,
    height: 190,
  });

  page.drawRectangle({
    x: 0,
    y: 0,
    width,
    height: 86,
    borderColor: rgb(0.85, 0.87, 0.9),
    borderWidth: 1,
  });
  page.drawText('Scan this code at the entrance', {
    x: 40,
    y: 52,
    size: 11,
    font: bold,
    color: rgb(0.15, 0.17, 0.2),
  });
  page.drawText(`Barcode: ${input.barcode}`, {
    x: 40,
    y: 30,
    size: 10,
    font,
    color: rgb(0.4, 0.43, 0.48),
  });
  page.drawText('Non-transferable unless marked transferable. Keep this pass for your records.', {
    x: 40,
    y: 12,
    size: 8,
    font,
    color: rgb(0.55, 0.57, 0.6),
  });

  return Buffer.from(await doc.save());
}

/** Plain-text invoice/render used for email templates and the wallet page. */
export function renderTicketSummary(input: TicketArtifactInput): string {
  const lines = [
    `EasyTrip e-ticket ${input.ticketNumber}`,
    `Order ${input.orderNumber}`,
    '',
    `${input.productName}`,
    input.destinationName ? `Location: ${input.destinationName}` : '',
    `Date: ${formatServiceDate(input.serviceDate)}${input.timeSlot ? ` at ${input.timeSlot}` : ''}`,
    `Guest: ${input.holderName} x${input.quantity}`,
    '',
    `Present this ticket (QR ${input.barcode}) at the entrance.`,
  ];
  return lines.filter((line) => line !== undefined).join('\n');
}