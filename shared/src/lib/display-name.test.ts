import { describe, expect, it } from 'vitest';
import { toDisplayName } from './display-name.js';

describe('toDisplayName', () => {
  it.each([
    ['Idly [2 Ps]', 'Idly'],
    ['Paneer Tikka (Half)', 'Paneer Tikka'],
    ['Chicken Biryani (Serves 1) [Boneless]', 'Chicken Biryani'],
    ['Combo (2 pcs) with Coke', 'Combo with Coke'],
    ['Veg Thali (Large (Family))', 'Veg Thali'],
    ['Masala Dosa {Jain}', 'Masala Dosa'],
    ['Margherita Pizza (Medium', 'Margherita Pizza'],
    ['Cold Coffee - (500 ml)', 'Cold Coffee'],
    ['  Garlic   Bread  ', 'Garlic Bread'],
    ['Plain Naan', 'Plain Naan'],
  ])('%j -> %j', (input, expected) => {
    expect(toDisplayName(input)).toBe(expected);
  });

  it('returns an empty string when the whole name is bracketed', () => {
    expect(toDisplayName('(Free Item)')).toBe('');
  });

  it('never leaves bracket characters in the result', () => {
    for (const name of ['Roll )', 'a ] b', 'x}(y', '((((']) {
      expect(toDisplayName(name)).not.toMatch(/[()[\]{}]/);
    }
  });
});
