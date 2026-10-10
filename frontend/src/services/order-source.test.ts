import { afterEach, describe, expect, it, vi } from 'vitest';
import { apiOrderSource, defaultOrderSource, OrdersUnavailableError } from './order-source';

const ORDER = {
  orderId: 'A1',
  orderDate: '2026-09-28',
  orderTime: '20:15',
  restaurant: 'Imaginary Tandoor',
  totalPaidPaise: 36604,
  status: 'Delivered',
  statusCategory: 'successful',
  items: [{ name: 'Tandoori Chicken (breast Pcs)', quantity: 1 }],
};
const OK_BODY = {
  month: 'all',
  orders: [{ ...ORDER, gmailMessageId: 'should-be-dropped' }],
  quality: {
    rowsRead: 1,
    blankRows: 0,
    rejectedRows: 0,
    ordersWithConflictingTotals: 0,
    ordersMissingTotal: 0,
  },
  freshness: { fetchedAt: '2026-10-10T00:00:00.000Z', stale: false },
};

const mockFetch = (status: number, body: unknown) =>
  vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify(body), { status }));

afterEach(() => {
  vi.restoreAllMocks();
});

describe('apiOrderSource', () => {
  it('loads and validates orders from the same-origin API, keeping original names', async () => {
    const fetchSpy = mockFetch(200, OK_BODY);
    const orders = await apiOrderSource.loadOrders();
    expect(fetchSpy).toHaveBeenCalledWith('/api/orders?month=all', expect.anything());
    expect(orders[0]?.items[0]?.name).toBe('Tandoori Chicken (breast Pcs)');
    expect(JSON.stringify(orders)).not.toContain('should-be-dropped');
  });

  it('surfaces the backend’s safe error code', async () => {
    mockFetch(503, {
      statusCode: 503,
      error: 'Service Unavailable',
      message: 'x',
      code: 'UPSTREAM_AUTH',
    });
    await expect(apiOrderSource.loadOrders()).rejects.toMatchObject({ code: 'UPSTREAM_AUTH' });
  });

  it('rejects a response that does not match the contract', async () => {
    mockFetch(200, { orders: [{ orderId: 1 }] });
    await expect(apiOrderSource.loadOrders()).rejects.toMatchObject({ code: 'INVALID_RESPONSE' });
  });

  it('reports network failures', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new TypeError('Failed to fetch'));
    await expect(apiOrderSource.loadOrders()).rejects.toBeInstanceOf(OrdersUnavailableError);
  });
});

describe('defaultOrderSource', () => {
  it('uses the real API outside demo mode, with no fallback to demo data', async () => {
    expect(import.meta.env.MODE).not.toBe('demo');
    expect(defaultOrderSource()).toBe(apiOrderSource);
    mockFetch(503, {
      statusCode: 503,
      error: 'Service Unavailable',
      message: 'x',
      code: 'NOT_CONFIGURED',
    });
    await expect(defaultOrderSource().loadOrders()).rejects.toMatchObject({
      code: 'NOT_CONFIGURED',
    });
  });
});
