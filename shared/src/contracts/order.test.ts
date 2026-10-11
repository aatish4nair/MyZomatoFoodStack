import { describe, expect, it } from 'vitest';
import { OrdersResponseSchema } from './api.js';
import { MonthFilterSchema, OrderSchema, PublicOrderSchema } from './order.js';

const valid = {
  orderId: '1234567890',
  orderDate: '2026-09-14',
  orderTime: '21:05',
  restaurant: 'Test Kitchen',
  totalPaidPaise: 14950,
  status: 'Delivered',
  statusCategory: 'successful',
  items: [{ name: 'Idly [2 Ps]', quantity: 2 }],
};

describe('OrderSchema', () => {
  it('accepts a well-formed order and keeps the original item name', () => {
    expect(OrderSchema.parse(valid).items[0]?.name).toBe('Idly [2 Ps]');
  });

  it('allows unknown time, total and quantity as null (never guessed)', () => {
    const parsed = OrderSchema.parse({
      ...valid,
      orderTime: null,
      totalPaidPaise: null,
      items: [{ name: 'Idly', quantity: null }],
    });
    expect(parsed.totalPaidPaise).toBeNull();
  });

  it.each([
    ['bad date', { orderDate: '14/09/2026' }],
    ['bad time', { orderTime: '9pm' }],
    ['fractional paise', { totalPaidPaise: 10.5 }],
    ['negative amount', { totalPaidPaise: -1 }],
    ['empty restaurant', { restaurant: '' }],
    ['no items', { items: [] }],
    ['zero quantity', { items: [{ name: 'Idly', quantity: 0 }] }],
    ['unknown status category', { statusCategory: 'maybe' }],
  ])('rejects %s', (_label, override) => {
    expect(OrderSchema.safeParse({ ...valid, ...override }).success).toBe(false);
  });

  it('strips fields outside the contract (S. No., Gmail Message ID)', () => {
    const parsed = OrderSchema.parse({ ...valid, serialNumber: 7, gmailMessageId: 'abc' });
    expect(parsed).not.toHaveProperty('gmailMessageId');
    expect(parsed).not.toHaveProperty('serialNumber');
  });

  it('keeps API responses to the public fields only', () => {
    const response = OrdersResponseSchema.parse({
      month: 'all',
      orders: [
        {
          ...valid,
          orderId: 'o0001',
          gmailMessageId: 'abc',
          serialNumber: 7,
        },
      ],
      quality: { rowsRead: 1 },
      freshness: { fetchedAt: '2026-10-10T00:00:00.000Z', stale: false },
    });
    expect(Object.keys(response).sort()).toEqual(['freshness', 'month', 'orders']);
    expect(Object.keys(response.orders[0] ?? {}).sort()).toEqual([
      'items',
      'orderDate',
      'orderId',
      'restaurant',
      'statusCategory',
      'totalPaidPaise',
    ]);
    const json = JSON.stringify(response);
    for (const hidden of ['gmailMessageId', 'serialNumber', 'orderTime', '"status"', 'quality']) {
      expect(json).not.toContain(hidden);
    }
  });

  it('accepts only opaque order IDs in public responses (never a Zomato order ID)', () => {
    const order = { ...valid, orderId: 'o0042' };
    expect(PublicOrderSchema.safeParse(order).success).toBe(true);
    for (const id of [valid.orderId, '7123456789', 'o12', '']) {
      expect(PublicOrderSchema.safeParse({ ...order, orderId: id }).success).toBe(false);
    }
  });
});

describe('MonthFilterSchema', () => {
  it.each(['all', '2026-01', '2026-12'])('accepts %s', (value) => {
    expect(MonthFilterSchema.safeParse(value).success).toBe(true);
  });
  it.each(['2026-13', '2026-1', 'January', ''])('rejects %j', (value) => {
    expect(MonthFilterSchema.safeParse(value).success).toBe(false);
  });
});
