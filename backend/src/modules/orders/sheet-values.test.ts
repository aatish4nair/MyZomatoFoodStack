import { describe, expect, it } from 'vitest';
import { serial } from '../../test/sheet-fixtures.js';
import { parseQuantity, parseSheetDate, parseSheetTime, splitList } from './sheet-values.js';

describe('parseSheetDate', () => {
  it.each([
    [serial('2026-09-28'), '2026-09-28'],
    [serial('2026-09-28') + 0.85, '2026-09-28'],
    ['2026-09-28', '2026-09-28'],
    ['28/09/2026', '2026-09-28'],
    ['03/04/2026', '2026-04-03'], // day-first, never month-first
    ['28-09-2026', '2026-09-28'],
    ['28.09.2026', '2026-09-28'],
    ['28 Sep 2026', '2026-09-28'],
    ['28 September 2026', '2026-09-28'],
    ['Sep 28, 2026', '2026-09-28'],
    ['28/09/2026 20:15', '2026-09-28'],
  ])('%j -> %s', (input, expected) => {
    expect(parseSheetDate(input)).toBe(expected);
  });

  it.each([['31/02/2026'], ['2026-13-01'], ['yesterday'], [''], [null], [-3], ['09/28/2026']])(
    'rejects %j',
    (input) => {
      expect(parseSheetDate(input)).toBeNull();
    },
  );
});

describe('parseSheetTime', () => {
  it.each([
    [20.25 / 24, '20:15'],
    [serial('2026-09-28') + 0.5, '12:00'],
    ['20:15', '20:15'],
    ['8:05 PM', '20:05'],
    ['12:30 am', '00:30'],
    ['12:30 PM', '12:30'],
    ['08:15:42', '08:15'],
  ])('%j -> %s', (input, expected) => {
    expect(parseSheetTime(input)).toBe(expected);
  });

  it.each([['25:00'], ['13:00 PM'], ['soon'], [null]])('rejects %j', (input) => {
    expect(parseSheetTime(input)).toBeNull();
  });
});

describe('parseQuantity and splitList', () => {
  it('accepts positive whole quantities only', () => {
    expect(parseQuantity(2)).toBe(2);
    expect(parseQuantity(' 3 ')).toBe(3);
    expect(parseQuantity(0)).toBeNull();
    expect(parseQuantity(1.5)).toBeNull();
    expect(parseQuantity('two')).toBeNull();
    expect(parseQuantity('')).toBeNull();
  });

  it('splits semicolon lists and drops empty parts', () => {
    expect(splitList('Idly [2 Ps]; Vada ;; Coffee')).toEqual(['Idly [2 Ps]', 'Vada', 'Coffee']);
  });
});
