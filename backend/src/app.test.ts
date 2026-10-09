import type { FastifyInstance } from 'fastify';
import { afterEach, describe, expect, it } from 'vitest';
import { ApiErrorSchema, HealthResponseSchema } from '@food-stack/shared';
import { buildApp } from './app.js';
import { loadEnv } from './config/env.js';

const ALLOWED_ORIGIN = 'http://localhost:5173';
let app: FastifyInstance | undefined;

async function makeApp(overrides: Record<string, string> = {}): Promise<FastifyInstance> {
  app = await buildApp(loadEnv({ NODE_ENV: 'test', CORS_ORIGINS: ALLOWED_ORIGIN, ...overrides }));
  return app;
}

afterEach(async () => {
  await app?.close();
  app = undefined;
});

describe('GET /api/health', () => {
  it('returns a contract-valid health response', async () => {
    const res = await (await makeApp()).inject({ method: 'GET', url: '/api/health' });
    expect(res.statusCode).toBe(200);
    expect(HealthResponseSchema.parse(res.json())).toEqual({ status: 'ok' });
  });

  it('sends security headers, including a deny-all CSP', async () => {
    const res = await (await makeApp()).inject({ method: 'GET', url: '/api/health' });
    expect(res.headers['content-security-policy']).toContain("default-src 'none'");
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['x-frame-options']).toBeDefined();
    expect(res.headers['x-powered-by']).toBeUndefined();
  });
});

describe('CORS', () => {
  it('allows the configured origin', async () => {
    const res = await (
      await makeApp()
    ).inject({
      method: 'GET',
      url: '/api/health',
      headers: { origin: ALLOWED_ORIGIN },
    });
    expect(res.headers['access-control-allow-origin']).toBe(ALLOWED_ORIGIN);
  });

  it('does not allow other origins', async () => {
    const res = await (
      await makeApp()
    ).inject({
      method: 'GET',
      url: '/api/health',
      headers: { origin: 'https://evil.example' },
    });
    expect(res.headers['access-control-allow-origin']).toBeUndefined();
  });
});

describe('rate limiting', () => {
  it('returns 429 once the limit is exceeded', async () => {
    const server = await makeApp({ RATE_LIMIT_MAX: '2' });
    const codes: number[] = [];
    for (let i = 0; i < 3; i++) {
      codes.push((await server.inject({ method: 'GET', url: '/api/health' })).statusCode);
    }
    expect(codes).toEqual([200, 200, 429]);
  });
});

describe('error handling', () => {
  it('returns a JSON 404 for unknown routes', async () => {
    const res = await (await makeApp()).inject({ method: 'GET', url: '/api/nope' });
    expect(res.statusCode).toBe(404);
    expect(ApiErrorSchema.parse(res.json()).error).toBe('Not Found');
  });

  it('hides internal error details', async () => {
    const server = await makeApp();
    server.get('/api/boom', () => {
      throw new Error('database password is hunter2');
    });
    const res = await server.inject({ method: 'GET', url: '/api/boom' });
    expect(res.statusCode).toBe(500);
    expect(res.body).not.toContain('hunter2');
    expect(res.body).not.toContain('stack');
    expect(ApiErrorSchema.parse(res.json()).message).toBe('Something went wrong');
  });
});
