import type { FastifyInstance } from 'fastify';
import type { ApiError } from '@food-stack/shared';

const LOCAL_HOSTNAMES = new Set(['localhost', '127.0.0.1', '[::1]']);

/** Hostname part of a Host header ("localhost:5173" → "localhost", "[::1]:3000" → "[::1]"). */
export function hostnameOf(hostHeader: string | undefined): string {
  if (!hostHeader) return '';
  const host = hostHeader.trim().toLowerCase();
  if (host.startsWith('[')) return host.slice(0, host.indexOf(']') + 1);
  return host.split(':')[0] ?? '';
}

/**
 * Local-only access control (Phase 2). Together with binding to loopback (enforced in env.ts):
 * - Requests whose Host header is not localhost are refused. This defeats DNS-rebinding, where a
 *   website points its own domain at 127.0.0.1 to read local services from your browser.
 * - Cross-site browser requests are refused (Sec-Fetch-Site: cross-site), on top of CORS.
 * - API responses are marked no-store so personal data isn't kept in browser or proxy caches.
 * It does NOT protect against other people or programs on this computer; real authentication is
 * required before any deployment (see docs/security/SECURITY-MODEL.md).
 */
export function registerLocalOnly(app: FastifyInstance): void {
  app.addHook('onRequest', async (request, reply) => {
    const forbidden = (message: string): ApiError => ({
      statusCode: 403,
      error: 'Forbidden',
      message,
    });
    if (!LOCAL_HOSTNAMES.has(hostnameOf(request.headers.host))) {
      return reply
        .status(403)
        .send(forbidden('This API only serves requests addressed to localhost.'));
    }
    if (request.headers['sec-fetch-site'] === 'cross-site') {
      return reply.status(403).send(forbidden('Cross-site requests are not allowed.'));
    }
    return undefined;
  });
  app.addHook('onSend', async (_request, reply, payload) => {
    reply.header('Cache-Control', 'no-store');
    return payload;
  });
}
