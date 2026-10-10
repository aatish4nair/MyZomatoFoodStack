import { describe, expect, it } from 'vitest';
import { artFallbacks, categorize, FOOD_ART_RULES } from './food-category.js';

describe('categorize', () => {
  it.each([
    // The examples that were wrong or too broad before.
    ['Tandoori Chicken (breast Pcs)', 'tandoori-chicken'],
    ['Chicken Tandoori [Half]', 'tandoori-chicken'],
    ['Afghani Chicken', 'afghani-chicken'],
    ['Chicken Malai Tikka', 'afghani-chicken'],
    ['Chicken Dum Biryani (Serves 1)', 'chicken-biryani'],
    ['Mutton Biryani', 'mutton-biryani'],
    ['Egg Biryani', 'egg-biryani'],
    ['Veg Biryani', 'veg-biryani'],
    ['Hyderabadi Dum Biryani', 'biryani'],
    ['Idly [2 Ps]', 'idli'],
    ['Masala Dosa', 'dosa'],
    // Order matters.
    ['Chicken Tikka Masala', 'chicken-curry'],
    ['Butter Chicken', 'chicken-curry'],
    ['Chicken Tikka', 'chicken-tikka'],
    ['Paneer Tikka', 'paneer-tikka'],
    ['Paneer Butter Masala', 'paneer-curry'],
    ['Paneer Tikka Masala', 'paneer-curry'],
    ['Masala Dosa (Ghee Roast)', 'dosa'],
    ['Chicken Masala', 'chicken-curry'],
    ['Dal Makhani', 'dal'],
    ['Crispy Fried Chicken Wings', 'fried-chicken'],
    ['Butter Naan', 'naan-roti'],
    ['Steamed Veg Momos [6 Pcs]', 'momos'],
    ['Chicken Shawarma Roll', 'wrap-roll'],
    ['Coke (500 ml)', 'cold-drink'],
    ['Margherita Pizza (Medium)', 'pizza'],
    ['Garlic Breadsticks', 'garlic-bread'],
    ['Mango Lassi', 'lassi'],
    ['Cold Coffee', 'shake-coffee'],
  ])('%j -> %s', (name, expected) => {
    expect(categorize(name)).toBe(expected);
  });

  it('never classifies chicken dishes as fried chicken by default', () => {
    for (const name of [
      'Tandoori Chicken',
      'Afghani Chicken',
      'Chicken Biryani',
      'Chicken Curry',
    ]) {
      expect(categorize(name)).not.toBe('fried-chicken');
    }
  });

  it('returns null for foods without a category instead of guessing', () => {
    expect(categorize('Mystery Platter')).toBeNull();
    expect(categorize('Cream Roll')).toBeNull();
  });
});

describe('artFallbacks', () => {
  it('goes from the specific dish to its category-level fallback', () => {
    expect(artFallbacks('chicken-biryani')).toEqual(['chicken-biryani', 'biryani']);
    expect(artFallbacks('afghani-chicken')).toEqual(['afghani-chicken', 'chicken-curry', 'curry']);
    expect(artFallbacks('tandoori-chicken')).toEqual(['tandoori-chicken']);
  });

  it('only names parents that are real keys', () => {
    const keys = new Set<string>(FOOD_ART_RULES.map((r) => r[0]));
    for (const rule of FOOD_ART_RULES as readonly (readonly unknown[])[]) {
      if (rule[2] !== undefined) expect(keys).toContain(rule[2]);
    }
  });
});
