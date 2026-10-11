import { describe, expect, it } from 'vitest';
import type { Order } from '../contracts/order.js';
import {
  listMonths,
  matchesQuery,
  MAX_DISH_SUGGESTIONS,
  placeholderNames,
  searchSelection,
  selectionOf,
  selectionText,
  suggest,
  type SearchSelection,
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
const IDLY: SearchSelection = { kind: 'dish', key: 'idly', name: 'Idly' };

const orders: Order[] = [
  order({}),
  // One order with idly listed twice (two rows / two items): still ONE order.
  order({
    orderId: 'o2',
    orderDate: '2026-09-10',
    totalPaidPaise: 8000,
    items: [idly(1), idly(1)],
  }),
  // Idly together with another dish: counted, but its total can't be attributed to idly.
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

describe('searchSelection: a single dish', () => {
  it('counts distinct orders, adds quantities, and prices only orders with nothing else in them', () => {
    const outcome = searchSelection(orders, IDLY, '2026-09');
    expect(outcome.kind).toBe('match');
    if (outcome.kind !== 'match') return;
    expect(outcome.summary).toMatchObject({
      selection: 'dish',
      matchingOrderCount: 2, // o2 and o3; cancelled o6 excluded
      foodName: 'Idly',
      totalPaidPaise: 8000, // o2 only: o3 also had Filter Coffee, so its total is not attributed
      pricedOrderCount: 1,
      ordersWithOtherItems: 1,
      ordersMissingTotal: 0,
      totalQuantity: 4, // 1 + 1 (o2) + 2 (o3)
      orderDate: '2026-09-12',
    });
    expect(outcome.representative.item.name).toBe('Idly [2 Ps]'); // original preserved
  });

  it('reports an unknown quantity instead of guessing', () => {
    const outcome = searchSelection(orders, IDLY, '2026-08');
    expect(outcome.kind === 'match' && outcome.summary.totalQuantity).toBeNull();
  });

  it('flags orders with no known total instead of treating them as zero', () => {
    const withMissing = [
      ...orders,
      order({ orderId: 'o7', orderDate: '2026-09-20', totalPaidPaise: null, items: [idly()] }),
    ];
    const outcome = searchSelection(withMissing, IDLY, '2026-09');
    expect(outcome.kind === 'match' && outcome.summary).toMatchObject({
      matchingOrderCount: 3,
      totalPaidPaise: 8000,
      ordersMissingTotal: 1,
    });
  });

  it('covers every month with "all" and only the chosen month otherwise', () => {
    const all = searchSelection(orders, IDLY, 'all');
    expect(all.kind === 'match' && all.summary.matchingOrderCount).toBe(3);
    const august = searchSelection(orders, IDLY, '2026-08');
    expect(august.kind === 'match' && august.summary.matchingOrderCount).toBe(1);
  });

  it('reports no match without inventing a result, and never uses cancelled orders', () => {
    expect(
      searchSelection(orders, { kind: 'dish', key: 'pizza', name: 'Pizza' }, '2026-09'),
    ).toEqual({ kind: 'none', label: 'Pizza', month: '2026-09' });
    const onlyCancelled = orders.filter((o) => o.orderId === 'o6');
    expect(searchSelection(onlyCancelled, IDLY, 'all').kind).toBe('none');
  });

  it('lists the original item names behind a dish', () => {
    const data = [
      order({ orderId: 'h1', items: [{ name: 'Hot & Crispy Chicken - 4 pcs', quantity: 1 }] }),
      order({ orderId: 'h2', items: [{ name: 'Hot & Crispy Chicken -6pc', quantity: 1 }] }),
    ];
    const dish = suggest(data, 'hot crispy', 'all')[0];
    if (dish?.kind !== 'dish') throw new Error('expected a dish suggestion');
    const outcome = searchSelection(data, selectionOf(dish), 'all');
    expect(outcome.kind === 'match' && outcome.summary.variants).toEqual([
      {
        name: 'Hot & Crispy Chicken',
        orderCount: 2,
        quantity: 2,
        originalNames: ['Hot & Crispy Chicken - 4 pcs', 'Hot & Crispy Chicken -6pc'],
      },
    ]);
  });
});

describe('categories across variants and months', () => {
  const one = (orderId: string, name: string, orderDate: string, totalPaidPaise = 30000) =>
    order({ orderId, orderDate, totalPaidPaise, items: [{ name, quantity: 1 }] });
  const data: Order[] = [
    one('b1', 'Chicken Biryani', '2026-09-10'),
    one('b2', 'Chicken Hyderabadi Dum Biryani [1/2 Kg]. Serves 1-2', '2026-09-12', 45000),
    one('b3', 'Chicken Lucknowi Biryani [1/2Kg] Serves 1-2', '2025-03-01', 40000),
    one('b4', 'Veg Biryani', '2024-05-05', 20000),
    one('b5', 'Chicken Biryani Combo', '2026-10-01', 35000),
    // A biryani ordered with a dip: counted, total not attributed.
    order({
      orderId: 'b6',
      orderDate: '2026-09-20',
      totalPaidPaise: 50000,
      items: [
        { name: 'Half Chicken Dum Biryani', quantity: 1 },
        { name: 'Cheesy Dip', quantity: 2 },
      ],
    }),
    one('x1', 'Butter Naan', '2026-09-10', 6000),
  ];
  const BIRYANI: SearchSelection = { kind: 'category', category: 'Biryani' };

  it('includes every biryani variant across all months', () => {
    const outcome = searchSelection(data, BIRYANI, 'all');
    expect(outcome.kind).toBe('match');
    if (outcome.kind !== 'match') return;
    expect(outcome.summary).toMatchObject({
      selection: 'category',
      foodName: 'Biryani · All variants',
      matchingOrderCount: 6,
      totalPaidPaise: 30000 + 45000 + 40000 + 20000 + 35000, // b6 excluded (also had a dip)
      pricedOrderCount: 5,
      ordersWithOtherItems: 1,
      totalQuantity: 6, // biryani items only, not the dips
    });
    expect(outcome.summary.variants.map((v) => v.name).sort()).toEqual([
      'Chicken Biryani',
      'Chicken Biryani Combo',
      'Chicken Hyderabadi Dum Biryani',
      'Chicken Lucknowi Biryani',
      'Half Chicken Dum Biryani',
      'Veg Biryani',
    ]);
  });

  it('limits a category to the selected month', () => {
    const outcome = searchSelection(data, BIRYANI, '2026-09');
    expect(outcome.kind === 'match' && outcome.summary.matchingOrderCount).toBe(3); // b1, b2, b6
    expect(searchSelection(data, BIRYANI, '2025-11')).toEqual({
      kind: 'none',
      label: 'Biryani',
      month: '2025-11',
    });
  });

  it('counts an order with two variants of the category once, and prices it', () => {
    const twoKinds = [
      order({
        orderId: 'm1',
        totalPaidPaise: 70000,
        items: [
          { name: 'Chicken Biryani', quantity: 1 },
          { name: 'Mutton Biryani', quantity: 1 },
        ],
      }),
    ];
    const outcome = searchSelection(twoKinds, BIRYANI, 'all');
    expect(outcome.kind === 'match' && outcome.summary).toMatchObject({
      matchingOrderCount: 1,
      totalPaidPaise: 70000,
      ordersWithOtherItems: 0,
      totalQuantity: 2,
    });
  });

  it('suggests the category first, then individual dishes, without selecting anything', () => {
    const suggestions = suggest(data, 'biryani', 'all');
    expect(suggestions[0]).toMatchObject({
      kind: 'category',
      category: 'Biryani',
      label: 'Biryani · All variants',
      dishCount: 6,
      orderCount: 6,
    });
    expect(suggestions.slice(1).every((s) => s.kind === 'dish')).toBe(true);
    expect(suggestions.slice(1).map((s) => (s.kind === 'dish' ? s.name : ''))).toContain(
      'Chicken Lucknowi Biryani',
    );
  });

  it('suggests only foods ordered in the selected month', () => {
    const october = suggest(data, 'biryani', '2026-10');
    expect(october.map((s) => (s.kind === 'dish' ? s.name : s.label))).toEqual([
      'Biryani · All variants',
      'Chicken Biryani Combo',
    ]);
    expect(suggest(data, 'naan', '2025-03')).toEqual([]);
  });

  it('finds a category by partial name and by its search terms', () => {
    expect(suggest(data, 'bir', 'all')[0]).toMatchObject({ category: 'Biryani' });
    expect(suggest(data, 'briyani', 'all')[0]).toMatchObject({ category: 'Biryani' });
    // "chicken" is not a category word: only dishes are suggested.
    expect(suggest(data, 'chicken', 'all').every((s) => s.kind === 'dish')).toBe(true);
  });

  it('gives a single letter suggestions only', () => {
    const suggestions = suggest(data, 'c', 'all');
    expect(suggestions.length).toBeGreaterThan(0);
    expect(suggestions.length).toBeLessThanOrEqual(MAX_DISH_SUGGESTIONS + 3);
  });
});

describe('suggestions without duplicates', () => {
  const item = (name: string, quantity = 1) => ({ name, quantity });
  const data: Order[] = [
    order({ orderId: 'i1', items: [item('Tender Coconut Ice Cream 100ml')] }),
    order({ orderId: 'i2', items: [item('Tender Coconut Ice Cream 500ml', 2)] }),
    order({ orderId: 'i3', items: [item('Tender Coconut Ice Cream')] }),
    order({ orderId: 's1', items: [item('Steamed Chicken Momos')] }),
    order({ orderId: 's2', items: [item('Chicken Steamed Momos')] }),
    order({ orderId: 'r1', items: [item('Plain Tandoori Roti'), item('Tandoori Roti Plain')] }),
    order({ orderId: 'c1', items: [item('Chicken 65')] }),
  ];

  it('merges pack sizes, word order and punctuation into one dish', () => {
    const coconut = suggest(data, 'coconut', 'all').filter((s) => s.kind === 'dish');
    expect(coconut).toEqual([
      {
        kind: 'dish',
        key: 'coconut cream ice tender',
        name: 'Tender Coconut Ice Cream',
        category: 'Ice Cream',
        orderCount: 3,
      },
    ]);
    expect(suggest(data, 'momos', 'all').filter((s) => s.kind === 'dish')).toHaveLength(1);
    expect(suggest(data, 'roti', 'all').filter((s) => s.kind === 'dish')).toHaveLength(1);
  });

  it('keeps meaningful numbers and names', () => {
    expect(suggest(data, 'chicken 65', 'all')).toEqual([
      expect.objectContaining({ kind: 'dish', name: 'Chicken 65', category: 'Chicken Starters' }),
    ]);
  });

  it('caps the number of dish suggestions', () => {
    const many = Array.from({ length: MAX_DISH_SUGGESTIONS + 4 }, (_, i) =>
      order({ orderId: `m${String(i)}`, items: [item(`Special ${String(i)} Biryani`)] }),
    );
    expect(suggest(many, 'special', 'all')).toHaveLength(MAX_DISH_SUGGESTIONS);
  });

  it('returns nothing for an empty query', () => {
    expect(suggest(data, '   ', 'all')).toEqual([]);
  });

  it('turns a suggestion into a selection and the text shown in the field', () => {
    const [category] = suggest(data, 'ice cream', 'all');
    if (!category) throw new Error('expected a suggestion');
    expect(selectionOf(category)).toEqual({ kind: 'category', category: 'Ice Cream' });
    expect(selectionText(selectionOf(category))).toBe('Ice Cream');
  });

  it('never alters the original item names', () => {
    const before = JSON.stringify(data);
    suggest(data, 'ice', 'all');
    searchSelection(data, { kind: 'category', category: 'Ice Cream' }, 'all');
    expect(JSON.stringify(data)).toBe(before);
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
