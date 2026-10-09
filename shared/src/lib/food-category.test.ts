import { describe, expect, it } from 'vitest';
import { categorize } from './food-category.js';

describe('categorize', () => {
  it.each([
    ['Tandoori Chicken (breast Pcs)', 'tandoori-chicken'],
    ['Paneer Tikka', 'tandoori-chicken'],
    ['Chicken Tikka Masala', 'curry'],
    ['Masala Dosa', 'dosa-idli'],
    ['Idly [2 Ps]', 'dosa-idli'],
    ['Veg Hakka Noodles', 'noodles'],
    ['Chicken Dum Biryani (Serves 1)', 'biryani'],
    ['Steamed Veg Momos [6 Pcs]', 'momos'],
    ['Chicken Shawarma Roll', 'wrap-roll'],
    ['Cream Roll', null],
    ['Coke (500 ml)', 'cold-drink'],
    ['Chocolate Brownie', 'brownie-cake'],
    ['Margherita Pizza (Medium)', 'pizza'],
  ])('%j -> %j', (name, expected) => {
    expect(categorize(name)).toBe(expected);
  });

  it('returns null for foods without a category instead of guessing', () => {
    expect(categorize('Mystery Platter')).toBeNull();
  });
});
