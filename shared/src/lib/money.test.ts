import { describe, expect, it } from 'vitest';
import { parseRupeesToPaise, roundPaiseToRupees } from './money.js';

describe('parseRupeesToPaise', () => {
  it.each([
    [366.04, 36604],
    [0.1, 10],
    [1234, 123400],
    ['₹366.04', 36604],
    ['₹ 1,234.50', 123450],
    ['Rs. 99', 9900],
    ['INR 12.5', 1250],
    ['  480  ', 48000],
    [0, 0],
  ])('%j -> %d paise', (input, expected) => {
    expect(parseRupeesToPaise(input)).toBe(expected);
  });

  it.each([
    [''],
    ['abc'],
    [-5],
    ['-5'],
    ['12.345'],
    [12.345],
    [null],
    [undefined],
    [Number.NaN],
    ['1.2.3'],
  ])('rejects %j', (input) => {
    expect(parseRupeesToPaise(input)).toBeNull();
  });

  it('sums exactly in paise where floating-point rupees would drift', () => {
    const values = ['0.10', '0.20', '0.30'];
    expect(values.reduce((s, v) => s + (parseRupeesToPaise(v) ?? 0), 0)).toBe(60);
    expect(0.1 + 0.2 + 0.3).not.toBe(0.6); // why paise are used
  });
});

describe('roundPaiseToRupees (display only)', () => {
  it.each([
    [198539, 1985],
    [198549, 1985],
    [198550, 1986],
    [198599, 1986],
    [36604, 366],
    [0, 0],
    [49, 0],
    [50, 1],
  ])('%d paise -> ₹%d', (paise, rupees) => {
    expect(roundPaiseToRupees(paise)).toBe(rupees);
  });

  it('rounds the precise total, not the individual values', () => {
    const totals = [10049, 10049, 10049]; // ₹100.49 each
    const exact = totals.reduce((a, b) => a + b, 0); // 30147 paise
    expect(roundPaiseToRupees(exact)).toBe(301);
    // Rounding each value first would wrongly give ₹300.
    expect(totals.map(roundPaiseToRupees).reduce((a, b) => a + b, 0)).toBe(300);
  });
});
