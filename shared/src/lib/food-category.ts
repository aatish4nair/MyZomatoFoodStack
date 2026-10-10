/**
 * Art keys: which picture represents an item name. Keys are as specific as the dish's look
 * requires (tandoori chicken ≠ fried chicken ≠ Afghani chicken), and each may name a broader
 * `parent` used only as a category-level fallback when the specific artwork doesn't exist yet.
 *
 * Order matters: the first matching rule wins (e.g. "Chicken Tikka Masala" is a curry, not a
 * tikka). Items that match nothing return null and are never given an unrelated picture.
 * Matching uses the original item name; "N x " prefixes are already removed by the backend.
 */
const has = (...words: string[]): RegExp => new RegExp(`\\b(?:${words.join('|')})\\b`, 'i');
const both = (a: RegExp, b: RegExp) => (name: string) => a.test(name) && b.test(name);

const BIRYANI = has('biry?ani', 'biriyani');
const CHICKEN = has('chicken', 'murgh?');

type Rule = readonly [key: string, test: RegExp | ((name: string) => boolean), parent?: string];

const MASALA_CURRY = has(
  'tikka masala',
  'butter masala',
  'curry',
  'korma',
  'kadai',
  'kadhai',
  'handi',
  'lababdar',
  'do pyaza',
  'makhan(?:i|wala)',
  'changezi',
);

export const FOOD_ART_RULES = [
  // South Indian dishes first, so "Masala Dosa" is a dosa.
  ['idli', has('idl[iy]s?')],
  ['dosa', has('dosa', 'uttapam')],
  ['vada', has('vada', 'wada', 'vadai')],

  // Biryani: the variant decides what's on the plate.
  ['chicken-biryani', both(BIRYANI, CHICKEN), 'biryani'],
  ['mutton-biryani', both(BIRYANI, has('mutton', 'lamb', 'gosht')), 'biryani'],
  ['egg-biryani', both(BIRYANI, has('eggs?', 'anda')), 'biryani'],
  ['veg-biryani', both(BIRYANI, has('veg', 'vegetables?', 'paneer', 'subz')), 'biryani'],
  ['biryani', (n: string) => BIRYANI.test(n) || has('pulao', 'pulav').test(n)],
  ['fried-rice', has('fried rice')],

  // Chicken dishes look very different from one another.
  [
    'chicken-curry',
    (n: string) =>
      has('butter chicken', 'murgh makhani').test(n) ||
      (CHICKEN.test(n) && (MASALA_CURRY.test(n) || has('masala').test(n))),
    'curry',
  ],
  [
    'afghani-chicken',
    has('afghani', 'malai chicken', 'chicken malai', 'reshmi', 'creamy chicken'),
    'chicken-curry',
  ],
  ['tandoori-chicken', (n: string) => has('tandoori', 'tangdi').test(n) && CHICKEN.test(n)],
  [
    'chicken-tikka',
    (n: string) => has('tikka', 'kebab', 'kabab', 'seekh', 'shami').test(n) && CHICKEN.test(n),
    'kebab',
  ],
  [
    'paneer-tikka',
    (n: string) =>
      has('paneer').test(n) && has('tikka', 'tandoori').test(n) && !MASALA_CURRY.test(n),
    'kebab',
  ],
  [
    'fried-chicken',
    has('fried chicken', 'wings', 'drumsticks?', 'popcorn chicken', 'chicken 65', 'lollipop'),
  ],

  // Other curries and breads.
  [
    'paneer-curry',
    (n: string) =>
      has('paneer').test(n) &&
      (MASALA_CURRY.test(n) || has('masala', 'butter', 'shahi', 'palak', 'bhurji').test(n)),
    'curry',
  ],
  ['dal', has('dal', 'daal', 'dal makhani', 'dal tadka'), 'curry'],
  ['curry', (n: string) => MASALA_CURRY.test(n) || has('chole', 'rajma', 'kofta').test(n)],
  ['kebab', has('kebabs?', 'kababs?', 'seekh', 'tikka', 'tandoori')],
  ['naan-roti', has('naan', 'roti', 'paratha', 'parotta', 'kulcha', 'chapati', 'phulka')],

  // Everything else.
  ['ice-cream', has('ice ?cream', 'sundae', 'kulfi', 'gelato')],
  ['brownie-cake', has('brownies?', 'cakes?', 'cheesecake', 'pastry', 'muffins?', 'tiramisu')],
  ['donut', has('do(?:ugh)?nuts?')],
  ['momos', has('momos?', 'dumplings?', 'dim ?sums?')],
  ['samosa', has('samosas?', 'kachori', 'pakoras?')],
  ['pizza', has('pizzas?', 'margherita')],
  ['garlic-bread', has('garlic bread', 'garlic breadsticks?')],
  ['burger', has('burgers?', 'whopper')],
  ['sandwich', has('sandwich(?:es)?', 'sub', 'panini')],
  [
    'wrap-roll',
    (n: string) =>
      has('shawarma', 'wraps?', 'kathi', 'frankie').test(n) || /(?<!\bcream )\brolls?\b/i.test(n),
  ],
  ['noodles', has('noodles?', 'chow ?mein', 'hakka', 'ramen')],
  ['fries', has('fries')],
  [
    'cold-drink',
    has('coke', 'pepsi', 'sprite', 'thums ?up', 'soft drink', 'cold drink', 'mojito', 'lemonade'),
  ],
  ['lassi', has('lassi')],
  ['shake-coffee', has('shakes?', 'smoothie', 'cold coffee', 'frappe')],
  ['rasmalai', has('rasmalai')],
  ['sweets', has('rasgulla', 'gulab jamun', 'laddoo?', 'halwa', 'jalebi', 'kheer')],
] as const satisfies readonly Rule[];

export type FoodCategory = (typeof FOOD_ART_RULES)[number][0];

/** Every art key, most specific rules first (used to offer every available picture to the pile). */
export const FOOD_CATEGORIES: readonly FoodCategory[] = FOOD_ART_RULES.map((rule) => rule[0]);

const PARENT = new Map<string, string>();
for (const rule of FOOD_ART_RULES as readonly Rule[]) {
  if (rule[2] !== undefined) PARENT.set(rule[0], rule[2]);
}

/** The most specific art key for an item name, or null when nothing fits. */
export function categorize(itemName: string): FoodCategory | null {
  for (const [key, test] of FOOD_ART_RULES) {
    if (typeof test === 'function' ? test(itemName) : test.test(itemName)) return key;
  }
  return null;
}

/** `chicken-biryani` → ['chicken-biryani', 'biryani']: the key, then its category-level fallbacks. */
export function artFallbacks(key: FoodCategory): FoodCategory[] {
  const chain: FoodCategory[] = [key];
  for (
    let parent = PARENT.get(key);
    parent && !chain.includes(parent as FoodCategory);
    parent = PARENT.get(parent)
  ) {
    chain.push(parent as FoodCategory);
  }
  return chain;
}
