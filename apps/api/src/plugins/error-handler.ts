import type { FastifyInstance } from 'fastify';
import { ZodError } from 'zod';
import { logger } from '../lib/logger';
import { AppError } from '../utils/errors';

/** Converts Zod issues into a field-keyed payload the web client can render. */
function formatZodError(error: ZodError): Record<string, string> {
  const fields: Record<string, string> = {};
  for (const issue of error.issues) {
    fields[issue.path.join('.') || '_'] = issue.message;
  }
  return fields;
}

export function registerErrorHandler(app: FastifyInstance): void {
  app.setErrorHandler((error, request, reply) => {
    if (error instanceof ZodError) {
      return reply.status(422).send({
        error: {
          code: 'VALIDATION_FAILED',
          message: 'Some fields need your attention',
          fields: formatZodError(error),
          requestId: request.id,
        },
      });
    }

    if (error instanceof AppError) {
      return reply.status(error.statusCode).send({
        error: {
          code: error.code,
          message: error.message,
          ...(error.details ? { details: error.details } : {}),
          requestId: request.id,
        },
      });
    }

    // Fastify's own errors (malformed JSON, payload too large, 404 handler...).
    const fastifyError = error as { statusCode?: number; message?: string };
    const statusCode = fastifyError.statusCode ?? 500;
    if (statusCode >= 400 && statusCode < 500) {
      return reply.status(statusCode).send({
        error: { code: 'BAD_REQUEST', message: fastifyError.message ?? 'Bad request', requestId: request.id },
      });
    }

    request.log.error({ err: error }, 'unhandled error');
    // Fastify runs with its own logger disabled (we use `src/lib/logger`), so
    // `request.log` is a no-op sink. Log through ours or 5xx vanish silently.
    const unhandled = error as Error & { code?: string };
    logger.error(`unhandled error [${request.method} ${request.url}]`, {
      requestId: request.id,
      code: unhandled.code ?? 'INTERNAL',
      reason: unhandled.message,
      stack: unhandled.stack?.split('\n').slice(0, 6).join(' | '),
    });
    return reply.status(500).send({
      error: {
        code: 'INTERNAL',
        message: 'Something went wrong on our side. Please try again.',
        requestId: request.id,
      },
    });
  });

  app.setNotFoundHandler((request, reply) => {
    reply.status(404).send({
      error: { code: 'NOT_FOUND', message: `Route ${request.method} ${request.url} not found`, requestId: request.id },
    });
  });
}