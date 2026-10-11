import { describe, expect, it } from 'vitest';
import {
  categorizeDish,
  DISH_CATEGORIES,
  DISH_CATEGORY_OVERRIDES,
  dishTypeOf,
} from './dish-category.js';

describe('categorizeDish', () => {
  it.each([
    // Variants of one identity share a category.
    ['Chicken Biryani', 'Biryani'],
    ['Chicken Biryani Combo', 'Biryani'], // combo keeps its name, category = the food
    ['Chicken Hyderabadi Dum Biryani [1/2 Kg]. Serves 1-2', 'Biryani'],
    ['Chicken Lucknowi Biryani [1/2Kg] Serves 1-2', 'Biryani'],
    ['Half Chicken Dum Biryani', 'Biryani'],
    ['Veg Biryani', 'Biryani'],
    ['Mango Ice Cream (Medium Fat)', 'Ice Cream'],
    ['Tender Coconut Ice Cream 500ml', 'Ice Cream'],
    ['No Added Sugar Anjeer Ice Cream (Medium Fat)', 'Ice Cream'],
    ['Cheese Mushroom Malai Sandwich', 'Sandwich'],
    ['Peri Peri Chicken Sandwich', 'Sandwich'],
    ['Steamed Chicken Momos', 'Momos'],
    ['Chicken Kathi Roll [Jumbo]', 'Rolls'],
    ['Chicken Crispy & Crunchy Roll', 'Rolls'],
    ['Zinger Pro Burger', 'Burgers'],
    ['Chicken Whopper Jr Double Patty.', 'Burgers'], // no "burger" in the name
    ['Grill Chicken Whopper Deluxe Fizzy Meal', 'Burgers'],
    ['Piri Piri Chicken Pizza', 'Pizza'],
    ['Chicken Hakka Noodles', 'Noodles'],
    ['Chicken Maggie', 'Noodles'],
    ['Chicken Fried Rice Regular', 'Fried Rice'],
    ['Masala Dosa', 'Dosa'],
    ['Idli Sambhar - 4 pcs', 'Idli'],
    ['Sambar Vada (2 Nos.)', 'Vada'],
    ['Thai Vegetable Spring Roll', 'Spring Rolls'],
    ['Spicy Vegetable Tempura Sushi Roll', 'Sushi'],
    ['Pack of 4 Dips', 'Dips'],
    ['Masala Fries', 'Sides'],
    ['Garlic Breadsticks', 'Sides'],
    ['Veg Special Thali', 'Meal Combos'],
    ['Cold Coffee', 'Beverages'],
    ['Masala Lemonade', 'Beverages'],
    ['Qubani Ka Meetha', 'Desserts'],
    ['Assorted Eggless Brownies Box - 4 pcs', 'Desserts'],
    ['Rumali Roti', 'Roti'],
    ['Butter Naan', 'Naan'],
    ['Butter Chicken With Bone', 'Curries'],
    ['Chicken Leg Kabab', 'Kebabs & Tandoori'],
    ['4 Pc McSpicy Fried Chicken Bucket', 'Chicken Starters'],
    ['Chicken 65', 'Chicken Starters'],
  ])('%j → %s', (name, expected) => {
    expect(categorizeDish(name)).toBe(expected);
  });

  it.each([
    // Ambiguous names: the defining word wins over a shared one.
    ['Tandoori Chicken Tikka Sandwich', 'Sandwich'], // not Kebabs & Tandoori
    ['Non Veg Afghani Momos', 'Momos'], // not Afghani chicken
    ['Tandoori Flavour Dip - 20 gm', 'Dips'], // not tandoori
    ['(6Pc) Crunchy Chicken Nuggets + 1 Dip.', 'Chicken Starters'], // nuggets, not the dip
    ['Butter Tandoori Roti', 'Roti'], // not tandoori
    ['Chicken Tikka Roll', 'Rolls'], // not tikka
    ['Tandoori Chicken Masala', 'Curries'], // a masala gravy
    ['Chicken Tikka Shawarma', 'Shawarma'],
    ['Chicken Shawario Rice', 'Rice Bowls'], // not shawarma, not fried rice
    ['Cream Roll', 'Desserts'], // not a kathi roll
    ['Paneer Butter Masala', 'Curries'],
    ['Paneer Tikka', 'Kebabs & Tandoori'],
  ])('ambiguous %j → %s', (name, expected) => {
    expect(categorizeDish(name)).toBe(expected);
  });

  it('uses explicit decisions for names a keyword cannot place', () => {
    expect(categorizeDish('Alphonso Mango 100ml')).toBe('Ice Cream');
    expect(categorizeDish('Chicken Maxxx - BBQ (Med)')).toBe('Chicken Starters');
    expect(categorizeDish('Chicken Toofani')).toBe('Curries');
    expect(categorizeDish('Patiala House Chicken-homestyle')).toBe('Curries');
    for (const category of Object.values(DISH_CATEGORY_OVERRIDES)) {
      expect(DISH_CATEGORIES).toContain(category);
    }
  });

  it('puts unknown names in Other instead of guessing from a common word', () => {
    expect(categorizeDish('Mystery Platter')).toBe('Other');
    expect(categorizeDish('Chicken')).toBe('Other'); // "chicken" alone decides nothing
    expect(categorizeDish('Mango')).toBe('Other'); // fruit, drink or dessert?
    expect(categorizeDish('Masala')).toBe('Other');
  });

  it('gives every name exactly one category from the list', () => {
    for (const name of ['Chicken Biryani', 'Mystery Platter', 'Cheesy Dip']) {
      expect(DISH_CATEGORIES).toContain(categorizeDish(name));
    }
  });
});

describe('dishTypeOf', () => {
  it('ignores pack sizes, counts, brackets, case, punctuation and word order', () => {
    const same = [
      'Plain Tandoori Roti',
      'Tandoori Plain Roti',
      'Tandoori Roti Plain',
      'TANDOORI ROTI, PLAIN',
    ].map((n) => dishTypeOf(n).key);
    expect(new Set(same).size).toBe(1);
    expect(dishTypeOf('Hot & Crispy Chicken - 4 pcs').key).toBe(
      dishTypeOf('Hot & Crispy Chicken -6pc').key,
    );
    expect(dishTypeOf('Tender Coconut Ice Cream 500ml').name).toBe('Tender Coconut Ice Cream');
  });

  it('keeps meaningful variants apart', () => {
    expect(dishTypeOf('Chicken Biryani').key).not.toBe(dishTypeOf('Chicken Biryani Combo').key);
    expect(dishTypeOf('Butter Chicken').key).not.toBe(dishTypeOf('Butter Chicken With Bone').key);
  });

  it('never changes the original name', () => {
    const original = 'Chicken Hyderabadi Dum Biryani [1/2 Kg]. Serves 1-2';
    const copy = original;
    dishTypeOf(original);
    categorizeDish(original);
    expect(original).toBe(copy);
  });
});
