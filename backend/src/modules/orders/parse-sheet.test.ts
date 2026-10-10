import { describe, expect, it } from 'vitest';
import { DataUnavailableError } from '../../lib/data-errors.js';
import { GMAIL_ID, HEADER, row, serial } from '../../test/sheet-fixtures.js';
import { parseSheet } from './parse-sheet.js';

describe('parseSheet', () => {
  it('maps the documented columns into an order, keeping the original item name', () => {
    const { orders, quality } = parseSheet([HEADER, row()]);
    expect(orders).toEqual([
      {
        orderId: 'Z1001',
        orderDate: '2026-09-28',
        orderTime: '20:15',
        restaurant: 'Imaginary Tandoor',
        totalPaidPaise: 36604,
        status: 'Delivered',
        statusCategory: 'successful',
        items: [{ name: 'Tandoori Chicken (breast Pcs)', quantity: 1 }],
      },
    ]);
    expect(quality).toMatchObject({ rowsRead: 1, rejectedRows: 0, blankRows: 0 });
  });

  it('never outputs the Gmail Message ID or S. No.', () => {
    const json = JSON.stringify(parseSheet([HEADER, row({ 'S. No.': 987654 })]).orders);
    expect(json).not.toContain(GMAIL_ID);
    expect(json).not.toContain('987654');
  });

  it('finds columns by header name, in any order and with different spacing/case', () => {
    const shuffled = [7, 1, 5, 2, 8, 4, 6];
    const header = shuffled.map((i) => HEADER[i]?.toUpperCase().replace(' ', '  '));
    const data = shuffled.map((i) => row()[i]);
    expect(parseSheet([header, data]).orders[0]?.restaurant).toBe('Imaginary Tandoor');
  });

  it('fails safely when a required column is missing', () => {
    const header = HEADER.filter((h) => h !== 'Total Paid');
    expect(() => parseSheet([header])).toThrow(DataUnavailableError);
    expect(() => parseSheet([])).toThrow(DataUnavailableError);
  });

  it('skips blank rows and rejects rows missing required values (counted, not repaired)', () => {
    const { orders, quality, rejections } = parseSheet([
      HEADER,
      [],
      ['', '', '  '],
      row({ 'Order ID': '' }),
      row({ 'Order ID': 'Z2', 'Order Date': 'someday' }),
      row({ 'Order ID': 'Z3', Restaurant: '' }),
      row({ 'Order ID': 'Z4', 'Item Name': ' ; ' }),
      row({ 'Order ID': 'Z5' }),
    ]);
    expect(orders.map((o) => o.orderId)).toEqual(['Z5']);
    expect(quality).toMatchObject({ rowsRead: 7, blankRows: 2, rejectedRows: 4 });
    expect(rejections).toEqual({
      'missing-order-id': 1,
      'invalid-date': 1,
      'missing-restaurant': 1,
      'missing-item': 1,
    });
  });

  it('keeps an order with a missing or invalid amount, with total unknown (not zero)', () => {
    const { orders, quality } = parseSheet([
      HEADER,
      row({ 'Total Paid': '' }),
      row({ 'Order ID': 'Z2', 'Total Paid': 'free?' }),
    ]);
    expect(orders.map((o) => o.totalPaidPaise)).toEqual([null, null]);
    expect(quality.ordersMissingTotal).toBe(2);
  });

  it('parses text amounts and text dates', () => {
    const [order] = parseSheet([
      HEADER,
      row({ 'Total Paid': '₹1,234.50', 'Order Date': '05/10/2026', 'Order Time': '8:15 PM' }),
    ]).orders;
    expect(order).toMatchObject({
      totalPaidPaise: 123450,
      orderDate: '2026-10-05',
      orderTime: '20:15',
    });
  });

  it('treats a blank or invalid time as unknown without rejecting the row', () => {
    const { orders } = parseSheet([
      HEADER,
      row({ 'Order Time': '' }),
      row({ 'Order ID': 'Z2', 'Order Time': 'late' }),
    ]);
    expect(orders.map((o) => o.orderTime)).toEqual([null, null]);
  });

  it('merges rows sharing an order ID into one order with the total counted once', () => {
    const { orders } = parseSheet([
      HEADER,
      row({ 'Item Name': 'Butter Naan', Quantity: 2, 'Total Paid': 520 }),
      row({ 'S. No.': 2, 'Item Name': 'Dal Makhani', Quantity: 1, 'Total Paid': 520 }),
    ]);
    expect(orders).toHaveLength(1);
    expect(orders[0]?.totalPaidPaise).toBe(52000);
    expect(orders[0]?.items).toEqual([
      { name: 'Butter Naan', quantity: 2 },
      { name: 'Dal Makhani', quantity: 1 },
    ]);
  });

  it('marks conflicting totals for one order ID as unknown instead of summing them', () => {
    const { orders, quality } = parseSheet([
      HEADER,
      row({ 'Item Name': 'Butter Naan', 'Total Paid': 120 }),
      row({ 'S. No.': 2, 'Item Name': 'Dal Makhani', 'Total Paid': 400 }),
    ]);
    expect(orders[0]?.totalPaidPaise).toBeNull();
    expect(quality.ordersWithConflictingTotals).toBe(1);
  });

  it('counts exact duplicate rows (re-imported emails) once', () => {
    const { orders, quality } = parseSheet([HEADER, row(), row({ 'S. No.': 2 })]);
    expect(orders[0]?.items).toHaveLength(1);
    expect(quality.duplicateRows).toBe(1);
  });

  it('rejects an order whose rows disagree on date or restaurant', () => {
    const { orders, rejections } = parseSheet([
      HEADER,
      row({ 'Item Name': 'A' }),
      row({ 'Item Name': 'B', Restaurant: 'Somewhere Else' }),
    ]);
    expect(orders).toEqual([]);
    expect(rejections['conflicting-order-details']).toBe(2);
  });

  it('splits semicolon-separated items, pairing quantities only when the counts match', () => {
    const { orders } = parseSheet([
      HEADER,
      row({ 'Item Name': 'Idly [2 Ps]; Medu Vada; Filter Coffee', Quantity: '2; 1; 3' }),
      row({ 'Order ID': 'Z2', 'Item Name': 'Idly [2 Ps]; Medu Vada', Quantity: 3 }),
    ]);
    expect(orders[0]?.items).toEqual([
      { name: 'Idly [2 Ps]', quantity: 2 },
      { name: 'Medu Vada', quantity: 1 },
      { name: 'Filter Coffee', quantity: 3 },
    ]);
    // One quantity for two items is ambiguous: unknown, not guessed.
    expect(orders[1]?.items.map((i) => i.quantity)).toEqual([null, null]);
  });

  it('applies the status policy and keeps differing statuses as unknown', () => {
    const { orders } = parseSheet([
      HEADER,
      row({ 'Order ID': 'A', 'Order Status': 'Cancelled' }),
      row({ 'Order ID': 'B', 'Order Status': '' }),
      row({ 'Order ID': 'C', 'Order Status': 'Delivered', 'Item Name': 'X' }),
      row({ 'Order ID': 'C', 'Order Status': 'Refunded', 'Item Name': 'Y' }),
    ]);
    expect(orders.map((o) => o.statusCategory)).toEqual(['unsuccessful', 'unknown', 'unknown']);
  });

  it('handles a numeric order ID without scientific notation', () => {
    const [order] = parseSheet([HEADER, row({ 'Order ID': 7_654_321_098 })]).orders;
    expect(order?.orderId).toBe('7654321098');
  });

  it('accepts a sheet with only the required columns (time and quantity optional)', () => {
    const header = [
      'Order ID',
      'Order Date',
      'Restaurant',
      'Item Name',
      'Total Paid',
      'Order Status',
    ];
    const [order] = parseSheet([
      header,
      ['Z9', serial('2026-01-02'), 'R', 'Item', 100, 'Delivered'],
    ]).orders;
    expect(order).toMatchObject({ orderTime: null, items: [{ name: 'Item', quantity: null }] });
  });

  describe('"N x Item" quantities (the real sheet’s format)', () => {
    it('reads the prefix as quantity and keeps the rest of the name exactly, brackets included', () => {
      const [order] = parseSheet([
        HEADER,
        row({ 'Item Name': '1 x Tandoori Chicken (breast Pcs)', Quantity: 1 }),
      ]).orders;
      expect(order?.items).toEqual([{ name: 'Tandoori Chicken (breast Pcs)', quantity: 1 }]);
    });

    it('splits multi-item cells and uses per-item quantities that add up to the Quantity cell', () => {
      const [order] = parseSheet([
        HEADER,
        row({ 'Item Name': '2 x Butter Naan; 1 x Dal Makhani [Half]', Quantity: 3 }),
      ]).orders;
      expect(order?.items).toEqual([
        { name: 'Butter Naan', quantity: 2 },
        { name: 'Dal Makhani [Half]', quantity: 1 },
      ]);
    });

    it('marks quantities unknown when they disagree with the Quantity cell', () => {
      const [order] = parseSheet([
        HEADER,
        row({ 'Item Name': '2 x Butter Naan; 1 x Dal Makhani', Quantity: 5 }),
      ]).orders;
      expect(order?.items).toEqual([
        { name: 'Butter Naan', quantity: null },
        { name: 'Dal Makhani', quantity: null },
      ]);
    });

    it('uses the prefixes when the Quantity cell is blank', () => {
      const [order] = parseSheet([
        HEADER,
        row({ 'Item Name': '3 x Idly [2 Ps]', Quantity: '' }),
      ]).orders;
      expect(order?.items).toEqual([{ name: 'Idly [2 Ps]', quantity: 3 }]);
    });

    it('accepts "2x" and "2 ×" spellings', () => {
      const [order] = parseSheet([
        HEADER,
        row({ 'Item Name': '2x Garlic Naan; 1 × Paneer Tikka', Quantity: 3 }),
      ]).orders;
      expect(order?.items.map((i) => [i.name, i.quantity])).toEqual([
        ['Garlic Naan', 2],
        ['Paneer Tikka', 1],
      ]);
    });

    it('does not treat numbers that are part of a food name as quantities', () => {
      const [order] = parseSheet([
        HEADER,
        row({ 'Item Name': '7 Up (500 ml)', Quantity: 1 }),
        row({ 'Order ID': 'Z2', 'Item Name': '65 Chicken', Quantity: 2 }),
      ]).orders;
      expect(order?.items).toEqual([{ name: '7 Up (500 ml)', quantity: 1 }]);
    });

    it('falls back to the old rule when only some items carry a prefix', () => {
      const [order] = parseSheet([
        HEADER,
        row({ 'Item Name': '2 x Butter Naan; Dal Makhani', Quantity: 3 }),
      ]).orders;
      expect(order?.items.map((i) => i.quantity)).toEqual([null, null]);
      expect(order?.items[0]?.name).toBe('2 x Butter Naan');
    });
  });
});
