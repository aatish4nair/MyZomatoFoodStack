import { describe, expect, it } from 'vitest';
import { MonthFilterSchema, OrderLineSchema } from './order.js';

const valid = {
  orderId: '1234567890',
  orderDate: '2026-09-14',
  orderTime: '21:05',
  restaurant: 'Test Kitchen',
  itemName: 'Idly [2 Ps]',
  quantity: 2,
  totalPaid: 149.5,
  orderStatus: 'Delivered',
};

describe('OrderLineSchema', () => {
  it('accepts a well-formed order line and keeps the original item name', () => {
    expect(OrderLineSchema.parse(valid).itemName).toBe('Idly [2 Ps]');
  });

  it.each([
    ['bad date', { orderDate: '14/09/2026' }],
    ['bad time', { orderTime: '9pm' }],
    ['zero quantity', { quantity: 0 }],
    ['negative amount', { totalPaid: -1 }],
    ['empty restaurant', { restaurant: '' }],
  ])('rejects %s', (_label, override) => {
    expect(OrderLineSchema.safeParse({ ...valid, ...override }).success).toBe(false);
  });

  it('drops fields that are not part of the contract (e.g. Gmail Message ID)', () => {
    const parsed = OrderLineSchema.parse({ ...valid, gmailMessageId: 'abc' });
    expect(parsed).not.toHaveProperty('gmailMessageId');
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
