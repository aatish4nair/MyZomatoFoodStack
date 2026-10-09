import { describe, expect, it } from 'vitest';
import type { OrderLine } from '../contracts/order.js';
import { listMonths, matchesQuery, placeholderNames, searchOrders } from './food-search.js';

const line = (overrides: Partial<OrderLine>): OrderLine => ({
  orderId: 'o1',
  orderDate: '2026-09-28',
  orderTime: '20:15',
  restaurant: 'Demo Kitchen',
  itemName: 'Tandoori Chicken (breast Pcs)',
  quantity: 1,
  totalPaid: 366.04,
  orderStatus: 'Delivered',
  ...overrides,
});

const lines: OrderLine[] = [
  line({}),
  line({ orderId: 'o2', orderDate: '2026-09-10', itemName: 'Idly [2 Ps]', totalPaid: 80 }),
  line({
    orderId: 'o3',
    orderDate: '2026-09-12',
    itemName: 'Idly [2 Ps]',
    quantity: 2,
    totalPaid: 160,
  }),
  line({ orderId: 'o4', orderDate: '2026-08-02', itemName: 'Idly [2 Ps]', totalPaid: 75 }),
  line({ orderId: 'o5', orderDate: '2026-08-05', itemName: 'Classic Cold Coffee' }),
];

describe('matchesQuery', () => {
  it.each([
    ['chicken tandoori', true],
    ['tando', true],
    ['TANDOORI', true],
    ['breast', true],
    ['chicken biryani', false],
    ['', false],
  ])('%j', (query, expected) => {
    expect(matchesQuery('Tandoori Chicken (breast Pcs)', query)).toBe(expected);
  });

  it('matches word starts only ("lassi" must not match "Classic")', () => {
    expect(matchesQuery('Classic Cold Coffee', 'lassi')).toBe(false);
  });
});

describe('searchOrders', () => {
  it('is idle for an empty query', () => {
    expect(searchOrders(lines, '   ', '2026-09')).toEqual({ kind: 'idle' });
  });

  it('summarises matches in the selected month only', () => {
    const outcome = searchOrders(lines, 'idly', '2026-09');
    expect(outcome.kind).toBe('match');
    if (outcome.kind !== 'match') return;
    expect(outcome.summary).toMatchObject({
      matchingOrderCount: 2,
      foodName: 'Idly',
      totalPaid: 240,
      totalQuantity: 3,
      orderDate: '2026-09-12',
    });
    // The original name is preserved on the underlying line.
    expect(outcome.representative.itemName).toBe('Idly [2 Ps]');
  });

  it('covers every month with "all"', () => {
    const outcome = searchOrders(lines, 'idly', 'all');
    expect(outcome.kind === 'match' && outcome.summary.matchingOrderCount).toBe(3);
  });

  it('reports no match without inventing a result', () => {
    expect(searchOrders(lines, 'pizza', '2026-09')).toEqual({
      kind: 'none',
      query: 'pizza',
      month: '2026-09',
    });
  });

  it('removes brackets from the displayed food name', () => {
    const outcome = searchOrders(lines, 'chicken tandoori', '2026-09');
    expect(outcome.kind === 'match' && outcome.summary.foodName).toBe('Tandoori Chicken');
  });
});

describe('listMonths', () => {
  it('lists distinct months, newest first', () => {
    expect(listMonths(lines)).toEqual(['2026-09', '2026-08']);
  });
});

describe('placeholderNames', () => {
  it('strips brackets, removes duplicates and puts the most-ordered first', () => {
    expect(placeholderNames(lines)).toEqual(['Idly', 'Classic Cold Coffee', 'Tandoori Chicken']);
  });

  it('does not change the original item names', () => {
    const before = lines.map((l) => l.itemName);
    placeholderNames(lines);
    expect(lines.map((l) => l.itemName)).toEqual(before);
  });

  it('handles an empty dataset', () => {
    expect(placeholderNames([])).toEqual([]);
  });
});
