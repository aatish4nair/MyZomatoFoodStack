import { describe, expect, it } from 'vitest';
import {
  choosePileItems,
  computePileLayout,
  MAX_ITEM_SIZE,
  MAX_ITEMS,
  MIN_ITEM_SIZE,
  seededRandom,
} from './pile-layout';

describe('computePileLayout (responsive sizing)', () => {
  it.each([
    ['phone', 375, 150],
    ['tablet', 768, 200],
    ['laptop', 1440, 220],
    ['wide desktop', 2560, 240],
  ])('%s: items stay small and the count is bounded', (_label, width, height) => {
    const { itemSize, itemCount } = computePileLayout(width, height);
    expect(itemSize).toBeGreaterThanOrEqual(MIN_ITEM_SIZE);
    expect(itemSize).toBeLessThanOrEqual(MAX_ITEM_SIZE);
    expect(itemSize).toBeLessThanOrEqual(width * 0.12);
    expect(itemCount).toBeGreaterThan(0);
    expect(itemCount).toBeLessThanOrEqual(MAX_ITEMS);
  });

  it('drops nothing into a zero-sized zone', () => {
    expect(computePileLayout(0, 200).itemCount).toBe(0);
    expect(computePileLayout(800, 0).itemCount).toBe(0);
  });
});

describe('choosePileItems', () => {
  const weights = new Map([
    ['pizza', 5],
    ['idli', 1],
    ['coke', 0],
  ]);

  it('returns the requested count, includes every weighted kind, skips zero weights', () => {
    const items = choosePileItems(weights, 40, seededRandom(1));
    expect(items).toHaveLength(40);
    expect(new Set(items)).toEqual(new Set(['pizza', 'idli']));
  });

  it('follows the weights', () => {
    const items = choosePileItems(weights, 600, seededRandom(2));
    const pizzas = items.filter((k) => k === 'pizza').length;
    expect(pizzas / items.length).toBeGreaterThan(0.7);
  });

  it('is deterministic for a seed and handles empty input', () => {
    expect(choosePileItems(weights, 20, seededRandom(7))).toEqual(
      choosePileItems(weights, 20, seededRandom(7)),
    );
    expect(choosePileItems(new Map<string, number>(), 20, seededRandom(1))).toEqual([]);
  });
});
