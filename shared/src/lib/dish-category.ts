import { foodNameKey, toDisplayName } from './display-name.js';

/**
 * Dish categories for search: a broad food identity ("Biryani"), independent of the exact name a
 * restaurant uses ("Chicken Lucknowi Biryani [1/2Kg] Serves 1-2"). Separate from the art keys in
 * food-category.ts, which choose pictures.
 *
 * - The Dish Category is decided by the rules below (first match wins), or by an explicit entry in
 *   DISH_CATEGORY_OVERRIDES for names a keyword can't classify safely.
 * - The Dish Type is the dish itself: its display name (brackets, pack sizes and counts removed),
 *   compared ignoring case, punctuation and word order (see `dishTypeOf`).
 * - Names that fit no rule are `Other` and reported by `npm run dish:categories` for review.
 * Original item names are never changed; everything here is derived on the fly.
 */
export const DISH_CATEGORIES = [
  'Biryani',
  'Pizza',
  'Burgers',
  'Sandwich',
  'Momos',
  'Shawarma',
  'Rolls',
  'Spring Rolls',
  'Sushi',
  'Rice Bowls',
  'Fried Rice',
  'Noodles',
  'Dosa',
  'Idli',
  'Vada',
  'Kebabs & Tandoori',
  'Chicken Starters',
  'Curries',
  'Roti',
  'Naan',
  'Ice Cream',
  'Desserts',
  'Beverages',
  'Dips',
  'Sides',
  'Meal Combos',
  'Other',
] as const;

export type DishCategory = (typeof DISH_CATEGORIES)[number];

/** Extra words that find a category in search ("kathi" → Rolls), besides its own name. */
export const CATEGORY_SEARCH_TERMS: Partial<Record<DishCategory, readonly string[]>> = {
  Biryani: ['biriyani', 'briyani', 'pulao'],
  Pizza: ['pizzas'],
  Burgers: ['burger', 'whopper'],
  Sandwich: ['sandwiches'],
  Momos: ['momo', 'dumplings'],
  Rolls: ['roll', 'kathi', 'wrap', 'frankie'],
  'Kebabs & Tandoori': ['kebab', 'kabab', 'tikka', 'tandoori'],
  'Chicken Starters': ['starters', 'fried chicken', 'nuggets'],
  Curries: ['curry', 'gravy'],
  'Ice Cream': ['icecream'],
  Desserts: ['dessert', 'sweets'],
  Beverages: ['drinks', 'beverage'],
  Dips: ['dip', 'sauce'],
  'Meal Combos': ['combo', 'meal', 'thali'],
};

const has = (...words: string[]): RegExp => new RegExp(`\\b(?:${words.join('|')})\\b`, 'i');

type Rule = readonly [category: DishCategory, test: (name: string) => boolean];
const rule = (category: DishCategory, pattern: RegExp): Rule => [
  category,
  (name) => pattern.test(name),
];

const CHICKEN_OR_PANEER = has('chicken', 'murgh', 'paneer', 'mutton', 'egg', 'fish', 'prawns?');

/**
 * Ordered rules: specific identities first, so the defining word wins over a shared one.
 * "Tandoori Chicken Tikka Sandwich" is a sandwich, "Non Veg Afghani Momos" are momos,
 * "Tandoori Flavour Dip" is a dip, "Butter Tandoori Roti" is a roti, "Chicken Tikka Roll" is a roll
 * and "Tandoori Chicken Masala" is a curry; only then does "tandoori"/"tikka" mean Kebabs & Tandoori.
 * A common word alone (chicken, masala, crispy, butter, roll in "Cream Roll") never decides.
 */
const RULES: readonly Rule[] = [
  rule('Sushi', has('sushi', 'maki', 'nigiri', 'uramaki')),
  rule('Spring Rolls', has('spring rolls?')),
  rule('Biryani', has('biry?ani', 'biriyani', 'briyani', 'pulao', 'pulav')),
  rule('Pizza', has('pizzas?', 'margherita', 'calzone')),
  rule('Burgers', has('burgers?', 'whopper')),
  rule('Sandwich', has('sandwich(?:es)?', 'panini', 'sub')),
  rule('Momos', has('momos?', 'dumplings?', 'dim ?sums?')),
  rule('Rice Bowls', has('shawario rice', 'rice bowls?')),
  rule('Shawarma', has('shawarma', 'shawerma')),
  rule('Fried Rice', has('fried rice')),
  rule('Noodles', has('noodles?', 'hakka', 'chow ?mein', 'maggie?', 'ramen', 'pad thai')),
  rule('Dosa', has('dosa', 'uttapam')),
  rule('Idli', has('idl[iy]s?')),
  rule('Vada', has('vada', 'wada', 'vadai')),
  rule('Ice Cream', has('ice ?creams?', 'sundae', 'kulfi', 'gelato')),
  rule(
    'Desserts',
    has(
      'brownies?',
      'cakes?',
      'pastry',
      'waffles?',
      'meetha',
      'gulab jamun',
      'rasmalai',
      'rasgulla',
      'halwa',
      'kheer',
      'jalebi',
      'mousse',
      'cream roll',
      'donuts?',
      'doughnuts?',
    ),
  ),
  rule(
    'Beverages',
    has(
      'coffee',
      'tea',
      'chai',
      'lemonade',
      'lassi',
      'shakes?',
      'smoothie',
      'mojito',
      'juice',
      'coke',
      'pepsi',
      'sprite',
      'soda',
      'water',
    ),
  ),
  rule(
    'Chicken Starters',
    /\bnuggets?\b|\bwings?\b|\bfried chicken\b|\bbucket\b|\bpopcorn\b|\bhot\s*(?:&|and)\s*crispy\b|\bmanchurian\b|\bchilli chicken\b|\blollipop\b|\bchicken 65\b/i,
  ),
  rule('Dips', has('dips?', 'mayo', 'mayonnaise')),
  rule(
    'Sides',
    has('fries', 'garlic bread(?:sticks?)?', 'breadsticks?', 'wedges', 'raita', 'salad'),
  ),
  [
    'Curries',
    (name) =>
      has(
        'curry',
        'korma',
        'kadai',
        'kadhai',
        'handi',
        'makhani',
        'butter chicken',
        'rahra',
        'do pyaza',
        'lababdar',
        'dal',
        'daal',
        'rajma',
        'chole',
      ).test(name) ||
      (has('masala').test(name) && CHICKEN_OR_PANEER.test(name)),
  ],
  rule('Rolls', /\b(?:kathi|wraps?|frankie)\b|(?<!\bcream )\brolls?\b/i),
  rule('Naan', has('naans?')),
  rule('Roti', has('roti', 'rotis', 'paratha', 'parotta', 'kulcha', 'chapati', 'phulka')),
  rule(
    'Kebabs & Tandoori',
    has('tandoori', 'tikka', 'kebabs?', 'kababs?', 'seekh', 'afghani', 'malai chicken', 'reshmi'),
  ),
  rule('Meal Combos', has('thali', 'combo', 'meal')),
];

/**
 * Names whose category a keyword can't decide safely, by dish identity (`dishTypeOf(...).key`).
 * Each entry is a deliberate decision: review these when the menu changes.
 */
export const DISH_CATEGORY_OVERRIDES: Readonly<Record<string, DishCategory>> = {
  // "Alphonso Mango 100ml" is a 100 ml ice-cream tub; "mango" alone could be fruit or a drink.
  [foodNameKey('Alphonso Mango')]: 'Ice Cream',
  // A grilled/barbecued chicken piece, eaten as a starter.
  [foodNameKey('Chicken Maxxx BBQ')]: 'Chicken Starters',
  // Restaurant-specific names for chicken curries.
  [foodNameKey('Chicken Toofani')]: 'Curries',
  [foodNameKey('Patiala House Chicken-homestyle')]: 'Curries',
};

/**
 * The Dish Type: the dish as the user sees it (display name) and its identity key. Pack sizes,
 * piece counts, brackets, case, punctuation and word order don't create separate dishes:
 * "Tandoori Roti Plain" ≡ "Plain Tandoori Roti"; "Tender Coconut Ice Cream 500ml" ≡ "… 100ml".
 */
export function dishTypeOf(itemName: string): { key: string; name: string } {
  const name = toDisplayName(itemName) || itemName.trim();
  return { key: foodNameKey(name), name };
}

/** The one primary Dish Category for an original item name (`Other` when nothing fits). */
export function categorizeDish(itemName: string): DishCategory {
  const { key: dishKey, name } = dishTypeOf(itemName);
  const override = DISH_CATEGORY_OVERRIDES[dishKey];
  if (override) return override;
  // Rules see both the original name and the display name (pack sizes removed).
  for (const [category, test] of RULES) if (test(itemName) || test(name)) return category;
  return 'Other';
}
