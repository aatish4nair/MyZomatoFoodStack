import { describe, expect, it } from 'vitest';
import { categorizeStatus } from './order-status.js';

describe('categorizeStatus', () => {
  it.each([
    ['Delivered', 'successful'],
    ['delivered', 'successful'],
    ['Order Delivered', 'successful'],
    ['Completed', 'successful'],
    ['Cancelled', 'unsuccessful'],
    ['Canceled by restaurant', 'unsuccessful'],
    ['Refunded', 'unsuccessful'],
    ['Payment Failed', 'unsuccessful'],
    ['Delivery failed', 'unsuccessful'],
    ['Not delivered', 'unsuccessful'],
    ['', 'unknown'],
    ['On the way', 'unknown'],
    ['Placed', 'unknown'],
  ])('%j -> %s', (status, expected) => {
    expect(categorizeStatus(status)).toBe(expected);
  });
});
