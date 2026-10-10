import type { Order } from '@food-stack/shared';
import { describe, expect, it } from 'vitest';
import { computeInsights } from './compute-insights.js';

const order = (o: Partial<Order>): Order => ({
  orderId: 'o',
  orderDate: '2026-09-01',
  orderTime: null,
  restaurant: 'A',
  totalPaidPaise: 10000,
  status: 'Delivered',
  statusCategory: 'successful',
  items: [{ name: 'x', quantity: 1 }],
  ...o,
});

describe('computeInsights', () => {
  it('handles zero orders without dividing by zero', () => {
    expect(computeInsights([], 'all')).toMatchObject({
      totalSpendingPaise: 0,
      totalOrders: 0,
      averageSpendingPaise: null,
      mostOrderedRestaurant: null,
    });
  });

  it('sums each order once, counts unique IDs, and averages exactly', () => {
    const orders = [
      order({ orderId: '1', restaurant: 'A', totalPaidPaise: 36604 }),
      order({ orderId: '2', restaurant: 'B', totalPaidPaise: 10000 }),
      order({ orderId: '3', restaurant: 'A', totalPaidPaise: 20001 }),
      order({ orderId: '1', restaurant: 'A', totalPaidPaise: 36604 }), // same ID again: not double-counted
    ];
    expect(computeInsights(orders, 'all')).toMatchObject({
      totalSpendingPaise: 66605,
      totalOrders: 3,
      averageSpendingPaise: 22202, // 66605 / 3 = 22201.67 → 22202
      mostOrderedRestaurant: { restaurants: ['A'], orderCount: 2 },
    });
  });

  it('lists every tied restaurant alphabetically', () => {
    const orders = [
      order({ orderId: '1', restaurant: 'Zesty' }),
      order({ orderId: '2', restaurant: 'Alpha' }),
      order({ orderId: '3', restaurant: 'Mid' }),
    ];
    expect(computeInsights(orders, 'all').mostOrderedRestaurant).toEqual({
      restaurants: ['Alpha', 'Mid', 'Zesty'],
      orderCount: 1,
    });
  });

  it('excludes unsuccessful and unknown-status orders and reports them', () => {
    const orders = [
      order({ orderId: '1' }),
      order({
        orderId: '2',
        status: 'Cancelled',
        statusCategory: 'unsuccessful',
        totalPaidPaise: 99900,
      }),
      order({ orderId: '3', status: '', statusCategory: 'unknown' }),
    ];
    const insights = computeInsights(orders, 'all');
    expect(insights).toMatchObject({ totalSpendingPaise: 10000, totalOrders: 1 });
    expect(insights.basis).toMatchObject({ excludedUnsuccessful: 1, excludedUnknownStatus: 1 });
  });

  it('counts orders with unknown totals, but averages only over known totals', () => {
    const orders = [
      order({ orderId: '1', totalPaidPaise: 10000 }),
      order({ orderId: '2', totalPaidPaise: null }),
    ];
    const insights = computeInsights(orders, 'all');
    expect(insights).toMatchObject({
      totalOrders: 2,
      totalSpendingPaise: 10000,
      averageSpendingPaise: 10000,
    });
    expect(insights.basis).toMatchObject({ ordersWithKnownTotal: 1, ordersMissingTotal: 1 });
  });

  it('filters by month', () => {
    const orders = [
      order({ orderId: '1', orderDate: '2026-08-31' }),
      order({ orderId: '2', orderDate: '2026-09-01' }),
    ];
    expect(computeInsights(orders, '2026-09').totalOrders).toBe(1);
    expect(computeInsights(orders, '2026-07').totalOrders).toBe(0);
  });
});
