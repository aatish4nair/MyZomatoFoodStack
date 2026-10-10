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
  it('returns contract-valid orders with the original item names', async () => {
    await start();
    const res = await get('/api/orders');
    expect(res.statusCode).toBe(200);
    const body = OrdersResponseSchema.parse(res.json());
    expect(body.orders.map((o) => o.orderId)).toEqual(['A1', 'A2', 'A3']);
    expect(body.orders[1]?.items).toEqual([
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
    expect(august.orders.map((o) => o.orderId)).toEqual(['A2']);
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
});
