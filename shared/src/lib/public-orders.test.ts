import { describe, expect, it } from 'vitest';
import type { Order } from '../contracts/order.js';
import { PublicOrderSchema } from '../contracts/order.js';
import { toPublicOrders } from './public-orders.js';

const order = (orderId: string, orderDate: string, orderTime: string | null): Order => ({
  orderId,
  orderDate,
  orderTime,
  restaurant: 'Demo Kitchen',
  totalPaidPaise: 10000,
  status: 'Delivered',
  statusCategory: 'successful',
  items: [{ name: 'Idly [2 Ps]', quantity: 2 }],
});

describe('toPublicOrders', () => {
  const internal = [
    order('7000000003', '2026-09-28', '21:00'),
    order('7000000001', '2026-08-01', '12:00'),
    order('7000000002', '2026-09-28', '09:30'),
  ];

  it('replaces Zomato order IDs with opaque IDs assigned oldest → newest', () => {
    const result = toPublicOrders(internal);
    expect(result.map((o) => [o.orderId, o.orderDate])).toEqual([
      ['o0001', '2026-08-01'],
      ['o0002', '2026-09-28'], // the 09:30 order
      ['o0003', '2026-09-28'], // the 21:00 order: later on the same day, higher ID
    ]);
    expect(JSON.stringify(result)).not.toMatch(/700000000\d/);
  });

  it('keeps only the public fields (no time of day, no raw status)', () => {
    for (const publicOrder of toPublicOrders(internal)) {
      expect(Object.keys(publicOrder).sort()).toEqual([
        'items',
        'orderDate',
        'orderId',
        'restaurant',
        'statusCategory',
        'totalPaidPaise',
      ]);
      expect(PublicOrderSchema.parse(publicOrder)).toEqual(publicOrder);
    }
  });

  it('keeps original item names and quantities exactly', () => {
    expect(toPublicOrders(internal)[0]?.items).toEqual([{ name: 'Idly [2 Ps]', quantity: 2 }]);
  });

  it('widens IDs past 9999 orders and handles an empty list', () => {
    const many = Array.from({ length: 10_000 }, (_, i) => order(String(i), '2026-01-01', null));
    const ids = toPublicOrders(many).map((o) => o.orderId);
    expect(ids[0]).toBe('o00001');
    expect(ids.at(-1)).toBe('o10000');
    expect(new Set(ids).size).toBe(10_000);
    expect(toPublicOrders([])).toEqual([]);
  });

  it('does not modify the input', () => {
    const before = JSON.stringify(internal);
    toPublicOrders(internal);
    expect(JSON.stringify(internal)).toBe(before);
  });
});
