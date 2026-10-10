import { describe, expect, it } from 'vitest';
import type { Order } from '../contracts/order.js';
import {
  findVariants,
  listMonths,
  matchesQuery,
  MAX_VARIANT_OPTIONS,
  placeholderNames,
  searchOrders,
} from './food-search.js';

const order = (overrides: Partial<Order>): Order => ({
  orderId: 'o1',
  orderDate: '2026-09-28',
  orderTime: '20:15',
  restaurant: 'Demo Kitchen',
  totalPaidPaise: 36604,
  status: 'Delivered',
  statusCategory: 'successful',
  items: [{ name: 'Tandoori Chicken (breast Pcs)', quantity: 1 }],
  ...overrides,
});

const idly = (quantity: number | null = 1) => ({ name: 'Idly [2 Ps]', quantity });

const orders: Order[] = [
  order({}),
  // One order with idly listed twice (two rows / two items): still ONE order.
  order({
    orderId: 'o2',
    orderDate: '2026-09-10',
    totalPaidPaise: 8000,
    items: [idly(1), idly(1)],
  }),
  order({
    orderId: 'o3',
    orderDate: '2026-09-12',
    totalPaidPaise: 16000,
    items: [idly(2), { name: 'Filter Coffee', quantity: 1 }],
  }),
  order({ orderId: 'o4', orderDate: '2026-08-02', totalPaidPaise: 7500, items: [idly(null)] }),
  order({
    orderId: 'o5',
    orderDate: '2026-08-05',
    items: [{ name: 'Classic Cold Coffee', quantity: 1 }],
  }),
  order({
    orderId: 'o6',
    orderDate: '2026-09-15',
    status: 'Cancelled',
    statusCategory: 'unsuccessful',
    items: [idly()],
  }),
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
    expect(searchOrders(orders, '   ', '2026-09')).toEqual({ kind: 'idle' });
  });

  it('counts distinct orders, sums each order total once, and adds quantities', () => {
    const outcome = searchOrders(orders, 'idly', '2026-09');
    expect(outcome.kind).toBe('match');
    if (outcome.kind !== 'match') return;
    expect(outcome.summary).toMatchObject({
      matchingOrderCount: 2, // o2 and o3; cancelled o6 excluded
      foodName: 'Idly',
      totalPaidPaise: 24000, // 8000 + 16000, o2 counted once despite two idly items
      totalQuantity: 4,
      orderDate: '2026-09-12',
      ordersMissingTotal: 0,
    });
    expect(outcome.representative.item.name).toBe('Idly [2 Ps]'); // original preserved
  });

  it('reports an unknown quantity instead of guessing', () => {
    const outcome = searchOrders(orders, 'idly', '2026-08');
    expect(outcome.kind === 'match' && outcome.summary.totalQuantity).toBeNull();
  });

  it('flags orders with no known total instead of treating them as zero', () => {
    const withMissing = [
      ...orders,
      order({ orderId: 'o7', orderDate: '2026-09-20', totalPaidPaise: null, items: [idly()] }),
    ];
    const outcome = searchOrders(withMissing, 'idly', '2026-09');
    expect(outcome.kind === 'match' && outcome.summary).toMatchObject({
      matchingOrderCount: 3,
      totalPaidPaise: 24000,
      ordersMissingTotal: 1,
    });
  });

  it('covers every month with "all"', () => {
    const outcome = searchOrders(orders, 'idly', 'all');
    expect(outcome.kind === 'match' && outcome.summary.matchingOrderCount).toBe(3);
  });

  it('reports no match without inventing a result', () => {
    expect(searchOrders(orders, 'pizza', '2026-09')).toEqual({
      kind: 'none',
      query: 'pizza',
      month: '2026-09',
    });
  });

  it('never matches cancelled orders', () => {
    const onlyCancelled = orders.filter((o) => o.orderId === 'o6');
    expect(searchOrders(onlyCancelled, 'idly', 'all').kind).toBe('none');
  });

  it('removes brackets from the displayed food name', () => {
    const outcome = searchOrders(orders, 'chicken tandoori', '2026-09');
    expect(outcome.kind === 'match' && outcome.summary.foodName).toBe('Tandoori Chicken');
  });
});

describe('listMonths', () => {
  it('lists distinct months with counted orders, newest first', () => {
    expect(listMonths(orders)).toEqual(['2026-09', '2026-08']);
  });
});

describe('placeholderNames', () => {
  it('strips brackets, removes duplicates, most-ordered first, skips cancelled orders', () => {
    expect(placeholderNames(orders)).toEqual([
      'Idly',
      'Classic Cold Coffee',
      'Filter Coffee',
      'Tandoori Chicken',
    ]);
  });

  it('does not change the original item names', () => {
    const before = JSON.stringify(orders);
    placeholderNames(orders);
    expect(JSON.stringify(orders)).toBe(before);
  });

  it('handles an empty dataset', () => {
    expect(placeholderNames([])).toEqual([]);
  });
});

describe('variant clarification', () => {
  const biryani = (
    orderId: string,
    name: string,
    orderDate = '2026-09-10',
    totalPaidPaise = 30000,
  ) => order({ orderId, orderDate, totalPaidPaise, items: [{ name, quantity: 1 }] });
  const data: Order[] = [
    biryani('b1', 'Chicken Biryani (Serves 1)'),
    biryani('b2', 'Chicken Biryani [Boneless]', '2026-09-12'),
    biryani('b3', 'Mutton Biryani'),
    biryani('b4', 'Veg Biryani'),
    biryani('b5', 'Egg Biryani', '2026-08-01'),
  ];

  it('asks which variant when a generic query matches several foods (from the data, most-ordered first)', () => {
    const outcome = searchOrders(data, 'Biryani', '2026-09');
    expect(outcome).toEqual({
      kind: 'clarify',
      query: 'Biryani',
      month: '2026-09',
      options: [
        { name: 'Chicken Biryani', orderCount: 2 }, // two bracket variants are one food
        { name: 'Mutton Biryani', orderCount: 1 },
        { name: 'Veg Biryani', orderCount: 1 },
      ],
      moreCount: 0,
    });
  });

  it('offers only variants from the selected month', () => {
    const outcome = searchOrders(data, 'biryani', 'all');
    expect(outcome.kind === 'clarify' && outcome.options.map((o) => o.name)).toContain(
      'Egg Biryani',
    );
    expect(searchOrders(data, 'biryani', '2026-08').kind).toBe('match'); // only Egg Biryani in August
  });

  it('shows results directly for an exact food name, in any word order, without asking', () => {
    const outcome = searchOrders(data, 'chicken biryani', '2026-09');
    expect(outcome.kind).toBe('match');
    if (outcome.kind !== 'match') return;
    expect(outcome.summary).toMatchObject({
      foodName: 'Chicken Biryani',
      matchingOrderCount: 2,
      totalPaidPaise: 60000,
    });
    expect(searchOrders(data, 'Biryani Chicken', '2026-09').kind).toBe('match');
  });

  it('selecting a suggestion (searching its name) gives that food only', () => {
    const outcome = searchOrders(data, 'Mutton Biryani', '2026-09');
    expect(outcome.kind === 'match' && outcome.summary).toMatchObject({
      foodName: 'Mutton Biryani',
      matchingOrderCount: 1,
    });
  });

  it('shows the only variant directly', () => {
    expect(searchOrders(data, 'mutton', '2026-09').kind).toBe('match');
  });

  it('reports no match when no variant matches', () => {
    expect(searchOrders(data, 'pulao', '2026-09').kind).toBe('none');
  });

  it('lists at most MAX_VARIANT_OPTIONS and counts the rest', () => {
    const many = Array.from({ length: MAX_VARIANT_OPTIONS + 3 }, (_, i) =>
      biryani(`m${String(i)}`, `Special ${String(i)} Biryani`),
    );
    const outcome = searchOrders(many, 'biryani', '2026-09');
    expect(outcome.kind === 'clarify' && [outcome.options.length, outcome.moreCount]).toEqual([
      MAX_VARIANT_OPTIONS,
      3,
    ]);
  });

  it('findVariants never alters the original names', () => {
    const before = JSON.stringify(data);
    findVariants(data, 'biryani', 'all');
    expect(JSON.stringify(data)).toBe(before);
  });
});

describe('clean display names in search', () => {
  const item = (name: string, quantity = 1) => ({ name, quantity });
  const data: Order[] = [
    order({
      orderId: 'i1',
      orderDate: '2026-09-02',
      totalPaidPaise: 9000,
      items: [item('Tender Coconut Ice Cream 100ml')],
    }),
    order({
      orderId: 'i2',
      orderDate: '2026-09-05',
      totalPaidPaise: 32000,
      items: [item('Tender Coconut Ice Cream 500ml', 2)],
    }),
    order({
      orderId: 'h1',
      orderDate: '2026-09-07',
      totalPaidPaise: 45050,
      items: [item('Chicken Hyderabadi Dum Biryani [1/2 Kg]. Serves 1-2')],
    }),
    order({
      orderId: 'c1',
      orderDate: '2026-09-08',
      totalPaidPaise: 26000,
      items: [item('Chicken 65')],
    }),
  ];

  it('merges pack sizes into one food with exact order counts and totals', () => {
    const outcome = searchOrders(data, 'tender coconut ice cream', '2026-09');
    expect(outcome.kind === 'match' && outcome.summary).toMatchObject({
      foodName: 'Tender Coconut Ice Cream',
      matchingOrderCount: 2,
      totalPaidPaise: 41000, // 9000 + 32000 paise, unchanged by display cleaning
      totalQuantity: 3,
    });
    expect(findVariants(data, 'coconut', '2026-09')).toEqual([
      { name: 'Tender Coconut Ice Cream', orderCount: 2 },
    ]);
  });

  it('finds orders by the cleaned name and by words from the original name', () => {
    expect(searchOrders(data, 'chicken hyderabadi dum biryani', '2026-09').kind).toBe('match');
    const byOriginal = searchOrders(data, 'biryani serves', '2026-09');
    expect(byOriginal.kind === 'match' && byOriginal.summary.foodName).toBe(
      'Chicken Hyderabadi Dum Biryani',
    );
    // The original name is preserved on the underlying item.
    expect(byOriginal.kind === 'match' && byOriginal.representative.item.name).toBe(
      'Chicken Hyderabadi Dum Biryani [1/2 Kg]. Serves 1-2',
    );
  });

  it('keeps meaningful numbers in names', () => {
    const outcome = searchOrders(data, 'chicken 65', '2026-09');
    expect(outcome.kind === 'match' && outcome.summary.foodName).toBe('Chicken 65');
  });

  it('shows cleaned names in the placeholder, without duplicates', () => {
    expect(placeholderNames(data)).toEqual([
      'Tender Coconut Ice Cream',
      'Chicken 65',
      'Chicken Hyderabadi Dum Biryani',
    ]);
  });
});
