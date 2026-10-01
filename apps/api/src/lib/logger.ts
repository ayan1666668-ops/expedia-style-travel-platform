/** Minimal structured logger - JSON in production, readable in development. */

type Level = 'debug' | 'info' | 'warn' | 'error';

const LEVEL_ORDER: Record<Level, number> = { debug: 10, info: 20, warn: 30, error: 40 };

const isProduction = process.env.NODE_ENV === 'production';
const minLevel: Level = (process.env.LOG_LEVEL as Level) || 'info';

function write(level: Level, message: string, meta?: Record<string, unknown>) {
  if (LEVEL_ORDER[level] < LEVEL_ORDER[minLevel]) return;

  if (isProduction) {
    process.stdout.write(
      `${JSON.stringify({ ts: new Date().toISOString(), level, message, ...meta })}\n`,
    );
    return;
  }

  const prefix = { debug: '·', info: '›', warn: '!', error: '✗' }[level];
  const suffix = meta && Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
  const line = `${new Date().toISOString().slice(11, 23)} ${prefix} ${message}${suffix}`;
  if (level === 'error') process.stderr.write(`${line}\n`);
  else process.stdout.write(`${line}\n`);
}

export const logger = {
  debug: (message: string, meta?: Record<string, unknown>) => write('debug', message, meta),
  info: (message: string, meta?: Record<string, unknown>) => write('info', message, meta),
  warn: (message: string, meta?: Record<string, unknown>) => write('warn', message, meta),
  error: (message: string, meta?: Record<string, unknown>) => write('error', message, meta),
};