import { describe, expect, it } from 'vitest';
import { toDisplayName } from './display-name.js';
import { categorize } from './food-category.js';

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

describe('toDisplayName: clean dish names (owner examples)', () => {
  it.each([
    ['(6Pc) Crunchy Chicken Nuggets + 1 Dip.', 'Crunchy Chicken Nuggets and Dip'],
    ['4 Pc McSpicy Fried Chicken Bucket', 'McSpicy Fried Chicken Bucket'],
    ['Chicken Hyderabadi Dum Biryani [1/2 Kg]. Serves 1-2', 'Chicken Hyderabadi Dum Biryani'],
    ['Chicken Lucknowi Biryani [1/2Kg] Serves 1-2', 'Chicken Lucknowi Biryani'],
    ['No Added Sugar Mango Ice Cream (Medium Fat)', 'No Added Sugar Mango Ice Cream'],
    ['Tender Coconut Ice Cream 100ml', 'Tender Coconut Ice Cream'],
    ['Tender Coconut Ice Cream 500ml', 'Tender Coconut Ice Cream'],
    ['Hot & Crispy Chicken - 6pc', 'Hot & Crispy Chicken'],
    ['Tandoori Chicken (breast Pcs)', 'Tandoori Chicken'],
    ['Tandoori Malai Chicken (white)', 'Tandoori Malai Chicken'],
    ['Assorted Eggless Brownies Box - 4 pcs', 'Assorted Eggless Brownies'],
    ['Sambar Vada (2 Nos.)', 'Sambar Vada'],
  ])('%j -> %j', (input, expected) => {
    expect(toDisplayName(input)).toBe(expected);
  });
});

describe('toDisplayName: other metadata and edge cases', () => {
  it.each([
    ['Coke 500 ml', 'Coke'],
    ['Pepsi 1.5L', 'Pepsi'],
    ['Paneer Tikka 250g', 'Paneer Tikka'],
    ['Veg Momos 8 Pieces', 'Veg Momos'],
    ['Samosa Pack of 2', 'Samosa'],
    ['Family Biryani. Serves 2 to 3', 'Family Biryani'],
    ['Chicken Wings - 6 Pcs.', 'Chicken Wings'],
    ['Burger + Fries', 'Burger and Fries'],
    ['Garlic Bread (4 Pcs) + 2 Dips', 'Garlic Bread and Dips'],
  ])('%j -> %j', (input, expected) => {
    expect(toDisplayName(input)).toBe(expected);
  });

  it.each([
    'Chicken 65',
    '7 Up',
    '65 Chicken',
    'No Added Sugar Lassi',
    'Rice Box',
    'Fried Chicken Bucket',
    'Hot & Sour Soup',
    'Death By Chocolate',
    '5 Spice Noodles',
  ])('keeps the meaningful name %j intact', (name) => {
    expect(toDisplayName(name)).toBe(name);
  });

  it('merges size variants into one display name', () => {
    expect(toDisplayName('Tender Coconut Ice Cream 100ml')).toBe(
      toDisplayName('Tender Coconut Ice Cream 500ml'),
    );
  });

  it('returns an empty string when only metadata is left (callers fall back to the original)', () => {
    expect(toDisplayName('(2 Pcs)')).toBe('');
    expect(toDisplayName('500ml')).toBe('');
  });

  it('never changes which picture a dish gets (categories use the original name)', () => {
    for (const name of [
      'Chicken Hyderabadi Dum Biryani [1/2 Kg]. Serves 1-2',
      'Tandoori Malai Chicken (white)',
      'Tender Coconut Ice Cream 500ml',
      'Assorted Eggless Brownies Box - 4 pcs',
      'Sambar Vada (2 Nos.)',
      '4 Pc McSpicy Fried Chicken Bucket',
    ]) {
      expect(categorize(toDisplayName(name))).toBe(categorize(name));
    }
  });
});
