import type { FastifyInstance } from 'fastify';
import type { ApiError } from '@food-stack/shared';

/** Hostname part of a Host header ("localhost:5173" → "localhost", "[::1]:3000" → "[::1]"). */
export function hostnameOf(hostHeader: string | undefined): string {
  if (!hostHeader) return '';
  const host = hostHeader.trim().toLowerCase();
  if (host.startsWith('[')) return host.slice(0, host.indexOf(']') + 1);
  return host.split(':')[0] ?? '';
}

/** Health checks carry no data, and a platform may probe them under an internal address. */
const HOST_CHECK_EXEMPT = new Set(['/api/health']);

/**
 * Request guards, locally and in a deployment:
 * - Requests whose Host header is not an allowed hostname (localhost, plus ALLOWED_HOSTS and the
 *   Render service hostname in production) are refused. Locally this defeats DNS-rebinding, where a
 *   website points its own domain at 127.0.0.1; deployed, the API answers only under its real
 *   names. The health check is exempt: it returns no data.
 * - Cross-site browser requests are refused (Sec-Fetch-Site: cross-site), on top of CORS. The
 *   website calls the API on its own origin (/api/* rewrite), so this never affects it.
 * - API responses are marked no-store.
 * There is no login: in a public deployment the order data is intentionally public
 * (see docs/deployment/RENDER.md).
 */
export function registerLocalOnly(app: FastifyInstance, allowedHosts: readonly string[]): void {
  const allowed = new Set(allowedHosts.map((host) => host.toLowerCase()));
  app.addHook('onRequest', async (request, reply) => {
    const forbidden = (message: string): ApiError => ({
      statusCode: 403,
      error: 'Forbidden',
      message,
    });
    const path = request.url.split('?')[0] ?? '';
    if (!HOST_CHECK_EXEMPT.has(path) && !allowed.has(hostnameOf(request.headers.host))) {
      return reply
        .status(403)
        .send(forbidden('This API does not serve requests addressed to this hostname.'));
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
