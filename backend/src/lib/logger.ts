import type { FastifyServerOptions } from 'fastify';
import type { Env } from '../config/env.js';

/**
 * Logger settings. Requests are logged as method + path only: query strings
 * (which may contain search terms) and headers (which may contain credentials)
 * are never written. Response bodies are never logged.
 */
export function loggerOptions(env: Env): NonNullable<FastifyServerOptions['logger']> {
  if (env.NODE_ENV === 'test') return false;
  return {
    level: env.LOG_LEVEL,
    redact: {
      paths: ['req.headers', 'req.query', 'req.body', 'res.headers'],
      censor: '[redacted]',
    },
    serializers: {
      req: (req: { method: string; url: string; id: string }) => ({
        id: req.id,
        method: req.method,
        path: req.url.split('?')[0],
      }),
    },
  };
}
