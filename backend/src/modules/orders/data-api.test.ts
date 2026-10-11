import type { FastifyInstance } from 'fastify';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiErrorSchema, InsightsSchema, OrdersResponseSchema } from '@food-stack/shared';
import { buildApp } from '../../app.js';
import { loadEnv } from '../../config/env.js';
import { DataUnavailableError } from '../../lib/data-errors.js';
import type { SheetValuesReader } from '../../integrations/google-sheets/sheets-reader.js';
import { GMAIL_ID, HEADER, row, serial } from '../../test/sheet-fixtures.js';

let app: FastifyInstance | undefined;
afterEach(async () => {
  await app?.close();
  app = undefined;
});

const ROWS = [
  HEADER,
  row({ 'S. No.': 101, 'Order ID': 'A1' }),
  row({
    'S. No.': 102,
    'Order ID': 'A2',
    'Order Date': serial('2026-08-15'),
    'Total Paid': '₹200.00',
    Restaurant: 'Other Place',
    'Item Name': 'Idly [2 Ps]; Vada',
    Quantity: '2; 1',
  }),
  row({ 'S. No.': 103, 'Order ID': 'A3', 'Order Status': 'Cancelled' }),
];

async function start(
  reader: SheetValuesReader | null = { readValues: () => Promise.resolve(ROWS) },
) {
  app = await buildApp(loadEnv({ NODE_ENV: 'test' }), { sheetsReader: reader });
  return app;
}

const get = async (url: string, headers: Record<string, string> = {}) =>
  (app ?? (await start())).inject({ method: 'GET', url, headers });

describe('GET /api/orders', () => {
  it('returns only the public fields, with opaque IDs and the original item names', async () => {
    await start();
    const res = await get('/api/orders');
    expect(res.statusCode).toBe(200);
    const raw = res.json<Record<string, unknown> & { orders: Record<string, unknown>[] }>();
    // Exactly these fields reach the browser: nothing else is serialised.
    expect(Object.keys(raw).sort()).toEqual(['freshness', 'month', 'orders']);
    for (const order of raw.orders) {
      expect(Object.keys(order).sort()).toEqual([
        'items',
        'orderDate',
        'orderId',
        'restaurant',
        'statusCategory',
        'totalPaidPaise',
      ]);
    }
    const body = OrdersResponseSchema.parse(raw);
    // Opaque IDs, oldest first (A2 in August, then A1 and A3), never the Zomato order IDs.
    expect(body.orders.map((o) => o.orderId)).toEqual(['o0001', 'o0002', 'o0003']);
    expect(res.body).not.toMatch(/"A[123]"/);
    expect(res.body).not.toMatch(/orderTime|"status"|quality|20:15/);
    expect(body.orders[0]?.items).toEqual([
      { name: 'Idly [2 Ps]', quantity: 2 },
      { name: 'Vada', quantity: 1 },
    ]);
    expect(body.freshness.stale).toBe(false);
  });

  it('never leaks Gmail Message IDs or sheet row numbers', async () => {
    await start();
    const res = await get('/api/orders');
    expect(res.body).not.toContain(GMAIL_ID);
    expect(res.body).not.toMatch(/gmail/i);
    expect(res.body).not.toMatch(/"(serialNumber|sNo)"/);
    expect(res.body).not.toContain('101');
  });

  it('filters by month and validates the month parameter', async () => {
    await start();
    const august = OrdersResponseSchema.parse((await get('/api/orders?month=2026-08')).json());
    expect(august.orders.map((o) => o.orderId)).toEqual(['o0001']); // same ID as in the full list
    const bad = await get('/api/orders?month=August');
    expect(bad.statusCode).toBe(400);
    expect(bad.body).not.toContain('August');
  });

  it('marks responses as not cacheable', async () => {
    await start();
    expect((await get('/api/orders')).headers['cache-control']).toBe('no-store');
  });
});

describe('GET /api/insights', () => {
  it('returns the four metrics, excluding cancelled orders', async () => {
    await start();
    const body = InsightsSchema.parse((await get('/api/insights')).json());
    expect(body).toMatchObject({
      totalSpendingPaise: 56604, // 36604 + 20000; cancelled A3 excluded
      totalOrders: 2,
      averageSpendingPaise: 28302,
      mostOrderedRestaurant: { restaurants: ['Imaginary Tandoor', 'Other Place'], orderCount: 1 },
      basis: { excludedUnsuccessful: 1 },
    });
  });

  it('supports the month filter', async () => {
    await start();
    const body = InsightsSchema.parse((await get('/api/insights?month=2026-08')).json());
    expect(body).toMatchObject({ totalOrders: 1, totalSpendingPaise: 20000 });
  });
});

describe('data errors', () => {
  it('reports NOT_CONFIGURED when no sheet is configured', async () => {
    await start(null);
    const res = await get('/api/orders');
    expect(res.statusCode).toBe(503);
    expect(ApiErrorSchema.parse(res.json()).code).toBe('NOT_CONFIGURED');
  });

  it.each(['UPSTREAM_AUTH', 'UPSTREAM_QUOTA', 'UPSTREAM_TIMEOUT', 'MALFORMED_SHEET'] as const)(
    'maps %s to a safe 503 without raw details',
    async (code) => {
      const failing = new DataUnavailableError(code);
      Object.assign(failing, {
        cause: new Error('raw google detail: key abc123 for robot@project.iam'),
      });
      await start({ readValues: () => Promise.reject(failing) });
      const res = await get('/api/insights');
      expect(res.statusCode).toBe(503);
      expect(ApiErrorSchema.parse(res.json()).code).toBe(code);
      expect(res.body).not.toMatch(/raw google|abc123|robot@|stack/);
    },
  );

  it('hides unexpected errors behind UPSTREAM_ERROR', async () => {
    await start({ readValues: () => Promise.reject(new Error('ECONNRESET 142.250.0.1')) });
    const res = await get('/api/orders');
    expect(ApiErrorSchema.parse(res.json()).code).toBe('UPSTREAM_ERROR');
    expect(res.body).not.toContain('142.250');
  });

  it('keeps the health endpoint free of configuration details', async () => {
    await start(null);
    expect((await get('/api/health')).json()).toEqual({ status: 'ok' });
  });
});

describe('local-only access control', () => {
  it.each(['localhost:3000', '127.0.0.1:3000', '[::1]:3000', 'localhost:5173'])(
    'allows Host %s',
    async (host) => {
      await start();
      expect((await get('/api/orders', { host })).statusCode).toBe(200);
    },
  );

  it.each(['evil.example', 'evil.example:3000', '192.168.1.20:3000', 'localhost.evil.example'])(
    'refuses Host %s (DNS rebinding)',
    async (host) => {
      const readValues = vi.fn(() => Promise.resolve(ROWS));
      await start({ readValues });
      const res = await get('/api/orders', { host });
      expect(res.statusCode).toBe(403);
      expect(readValues).not.toHaveBeenCalled();
    },
  );

  it('refuses cross-site browser requests', async () => {
    await start();
    expect((await get('/api/orders', { 'sec-fetch-site': 'cross-site' })).statusCode).toBe(403);
    expect((await get('/api/orders', { 'sec-fetch-site': 'same-origin' })).statusCode).toBe(200);
  });

  it('refuses cross-site requests to every data endpoint, but lets the health check through', async () => {
    await start();
    for (const url of ['/api/orders', '/api/insights', '/api/orders?month=all']) {
      const res = await get(url, { 'sec-fetch-site': 'cross-site' });
      expect(res.statusCode).toBe(403);
      expect(ApiErrorSchema.parse(res.json()).message).toBe('Cross-site requests are not allowed.');
      expect(res.body).not.toContain('Imaginary Tandoor');
    }
    // A link to the health check on another site (e.g. the Render dashboard) works: no data in it.
    const health = await get('/api/health', { 'sec-fetch-site': 'cross-site' });
    expect(health.statusCode).toBe(200);
    expect(health.json()).toEqual({ status: 'ok' });
    expect(health.headers['cache-control']).toBe('no-store');
  });

  it('keeps the local hostname check on data endpoints (DNS-rebinding protection)', async () => {
    await start();
    for (const url of ['/api/orders', '/api/insights']) {
      for (const host of ['evil.example', 'evil.example:3000', 'my-api.onrender.com']) {
        expect((await get(url, { host })).statusCode).toBe(403);
      }
    }
    // The exemption is for GET /api/health only, not for paths that merely start with it.
    expect((await get('/api/health/../orders', { host: 'evil.example' })).statusCode).toBe(403);
    expect((await get('/api/healthz', { host: 'evil.example' })).statusCode).toBe(403);
  });
});

describe('public deployment (production settings)', () => {
  const PROD = {
    NODE_ENV: 'production',
    HOST: '0.0.0.0',
    LOG_LEVEL: 'silent',
    RENDER_EXTERNAL_HOSTNAME: 'my-api.onrender.com',
    ALLOWED_HOSTS: 'my-site.onrender.com',
    TRUST_PROXY_HOPS: '1',
  };
  const startProd = async (extra: Record<string, string> = {}) => {
    app = await buildApp(loadEnv({ ...PROD, ...extra }), {
      sheetsReader: { readValues: () => Promise.resolve(ROWS) },
    });
    return app;
  };

  it('answers under the Render service and static-site hostnames only', async () => {
    await startProd();
    for (const host of ['my-api.onrender.com', 'my-site.onrender.com', 'localhost:10000']) {
      expect((await get('/api/orders', { host })).statusCode).toBe(200);
    }
    for (const host of ['evil.example', 'my-api.onrender.com.evil.example', '10.0.0.5:10000']) {
      const res = await get('/api/orders', { host });
      expect(res.statusCode).toBe(403);
      expect(res.body).not.toContain('Imaginary Tandoor');
    }
  });

  it('lets the platform health check through under any hostname, with no data', async () => {
    await startProd();
    const res = await get('/api/health', { host: '10.0.0.5:10000' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ status: 'ok' });
  });

  it('lets the health check through from a link on another site (e.g. the Render dashboard)', async () => {
    await startProd();
    const res = await get('/api/health', {
      host: 'my-api.onrender.com',
      'sec-fetch-site': 'cross-site',
      'sec-fetch-mode': 'navigate',
      referer: 'https://dashboard.render.com/',
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ status: 'ok' });
    expect(res.body).not.toMatch(/orders|GOOGLE|sheet/i);
  });

  it('still refuses cross-site browser requests and keeps the security headers', async () => {
    await startProd();
    for (const url of ['/api/orders', '/api/insights']) {
      const crossSite = await get(url, {
        host: 'my-api.onrender.com',
        'sec-fetch-site': 'cross-site',
      });
      expect(crossSite.statusCode).toBe(403);
      expect(crossSite.body).not.toContain('Imaginary Tandoor');
    }
    const res = await get('/api/orders', { host: 'my-site.onrender.com' });
    expect(res.headers['content-security-policy']).toContain("default-src 'none'");
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['cache-control']).toBe('no-store');
  });

  it('rate-limits per visitor behind one proxy hop, and a forged address does not help', async () => {
    await startProd({ RATE_LIMIT_MAX: '2' });
    // Render's proxy appends the real client address; a visitor may prepend a forged one.
    const as = (forwarded: string) =>
      get('/api/health', { host: 'my-api.onrender.com', 'x-forwarded-for': forwarded });
    expect((await as('203.0.113.7')).statusCode).toBe(200);
    expect((await as('1.1.1.1, 203.0.113.7')).statusCode).toBe(200);
    expect((await as('2.2.2.2, 203.0.113.7')).statusCode).toBe(429); // same real visitor
    expect((await as('198.51.100.9')).statusCode).toBe(200); // another visitor has their own limit
  });

  it('ignores X-Forwarded-For when no proxy is trusted (local default)', async () => {
    app = await buildApp(loadEnv({ NODE_ENV: 'test', RATE_LIMIT_MAX: '2' }), {
      sheetsReader: { readValues: () => Promise.resolve(ROWS) },
    });
    const as = (forwarded: string) => get('/api/health', { 'x-forwarded-for': forwarded });
    expect((await as('203.0.113.1')).statusCode).toBe(200);
    expect((await as('203.0.113.2')).statusCode).toBe(200);
    expect((await as('203.0.113.3')).statusCode).toBe(429); // forging addresses doesn't reset it
  });

  it('serves the same public fields as locally, and validates input the same way', async () => {
    await startProd();
    const body = OrdersResponseSchema.parse(
      (await get('/api/orders', { host: 'my-site.onrender.com' })).json(),
    );
    expect(body.orders.map((o) => o.orderId)).toEqual(['o0001', 'o0002', 'o0003']);
    const bad = await get('/api/insights?month=2026-13', { host: 'my-site.onrender.com' });
    expect(bad.statusCode).toBe(400);
    expect(ApiErrorSchema.parse(bad.json()).message).toBe('Request validation failed');
  });
});

describe('authentication diagnostics stay server-side', () => {
  const SECRET_EMAIL = 'svc-account@secret-project.iam.gserviceaccount.com';
  const EXPECTED_BODY =
    '{"statusCode":503,"error":"Service Unavailable","message":"The server could not access the spreadsheet (check credentials and sharing).","code":"UPSTREAM_AUTH"}';

  /** Builds the app with a failing reader and captures every warn log line (app + request). */
  async function failingApp(error: DataUnavailableError) {
    app = await buildApp(loadEnv({ NODE_ENV: 'test' }), {
      sheetsReader: { readValues: () => Promise.reject(error) },
    });
    const logged: unknown[] = [];
    vi.spyOn(app.log, 'warn').mockImplementation((...args: unknown[]) => {
      logged.push(args);
    });
    app.addHook('onRequest', (request, _reply, done) => {
      vi.spyOn(request.log, 'warn').mockImplementation((...args: unknown[]) => {
        logged.push(args);
      });
      done();
    });
    return logged;
  }

  it('keeps the public error response byte-for-byte unchanged, with or without a reason', async () => {
    await failingApp(new DataUnavailableError('UPSTREAM_AUTH', 'key-file-not-found'));
    const withReason = await get('/api/orders');
    await app?.close();
    await failingApp(new DataUnavailableError('UPSTREAM_AUTH'));
    const withoutReason = await get('/api/orders');
    expect(withReason.statusCode).toBe(503);
    expect(withReason.body).toBe(EXPECTED_BODY);
    expect(withoutReason.body).toBe(EXPECTED_BODY);
    expect(withReason.body).not.toContain('key-file');
    expect(withReason.body).not.toContain('reason');
  });

  it('logs the code and fixed-list reason, and nothing sensitive', async () => {
    const logged = await failingApp(new DataUnavailableError('UPSTREAM_AUTH', 'sheets-403'));
    expect((await get('/api/insights')).statusCode).toBe(503);
    const captured = JSON.stringify(logged);
    // Both log sites (refresh failure + request failure) carry the reason.
    expect(logged.length).toBeGreaterThanOrEqual(2);
    expect(captured).toContain('"code":"UPSTREAM_AUTH"');
    expect(captured).toContain('"reason":"sheets-403"');
    for (const secret of [
      SECRET_EMAIL,
      'BEGIN PRIVATE KEY',
      'Bearer',
      'Imaginary Tandoor',
      GMAIL_ID,
    ]) {
      expect(captured).not.toContain(secret);
    }
  });
});
