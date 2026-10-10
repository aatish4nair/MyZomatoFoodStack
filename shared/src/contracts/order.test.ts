import { describe, expect, it } from 'vitest';
import { OrdersResponseSchema } from './api.js';
import { MonthFilterSchema, OrderSchema } from './order.js';

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

  it('strips them from API responses too', () => {
    const response = OrdersResponseSchema.parse({
      month: 'all',
      orders: [{ ...valid, gmailMessageId: 'abc' }],
      quality: {
        rowsRead: 1,
        blankRows: 0,
        rejectedRows: 0,
        ordersWithConflictingTotals: 0,
        ordersMissingTotal: 0,
      },
      freshness: { fetchedAt: '2026-10-10T00:00:00.000Z', stale: false },
    });
    expect(JSON.stringify(response)).not.toContain('gmailMessageId');
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
