import { describe, expect, it } from 'vitest';
import { formatRupees } from './format';

describe('formatRupees (display only)', () => {
  it.each([
    [198539, '₹1,985'],
    [198550, '₹1,986'],
    [36604, '₹366'],
    [37250, '₹373'],
    [10000000, '₹1,00,000'],
    [0, '₹0'],
  ])('%d paise -> %s', (paise, text) => {
    expect(formatRupees(paise)).toBe(text);
  });

  it('never shows decimals', () => {
    expect(formatRupees(12345)).not.toMatch(/\./);
  });
});
