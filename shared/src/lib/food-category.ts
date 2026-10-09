/**
 * Art categories: which illustration represents an order line. Order matters, because the
 * first matching rule wins (e.g. "Masala Dosa" is a dosa, not a curry). Items that match
 * nothing return null and are never given an unrelated picture.
 */
export const FOOD_CATEGORIES = [
  ['dosa-idli', /\bdosa\b|\bidl[iy]s?\b|\buttapam\b|\bvada\b/i],
  ['ice-cream', /\bice ?cream\b|\bsundae\b|\bkulfi\b|\bgelato\b/i],
  ['brownie-cake', /\bbrownies?\b|\bcakes?\b|\bcheesecake\b|\bpastry\b|\bmuffins?\b|\btiramisu\b/i],
  ['donut', /\bdo(ugh)?nuts?\b/i],
  ['momos', /\bmomos?\b|\bdumplings?\b|\bdim ?sums?\b/i],
  ['samosa', /\bsamosas?\b|\bkachori\b|\bpakoras?\b/i],
  ['pizza', /\bpizzas?\b|\bmargherita\b/i],
  ['burger', /\bburgers?\b|\bwhopper\b/i],
  ['sandwich', /\bsandwich(es)?\b|\bsub\b|\bpanini\b/i],
  ['wrap-roll', /\bshawarma\b|\bwraps?\b|\bkathi\b|\bfrankie\b|(?<!\bcream )\brolls?\b/i],
  ['noodles', /\bnoodles?\b|\bchow ?mein\b|\bhakka\b|\bramen\b/i],
  ['biryani', /\bbiry?ani\b|\bpulao\b|\bfried rice\b/i],
  [
    'curry',
    /\bcurry\b|\bbutter chicken\b|\btikka masala\b|\bmakhan(i|wala)\b|\bkorma\b|\bkadai\b|\bdal\b|\bchole\b|\brajma\b/i,
  ],
  ['tandoori-chicken', /\btandoori\b|\btikka\b|\bkebabs?\b|\bkababs?\b|\bseekh\b/i],
  ['fried-chicken', /\bfried chicken\b|\bwings\b|\bdrumsticks?\b|\bpopcorn chicken\b/i],
  ['fries', /\bfries\b/i],
  [
    'cold-drink',
    /\bcoke\b|\bpepsi\b|\bsprite\b|\bthums ?up\b|\bsoft drink\b|\bcold drink\b|\bmojito\b|\blemonade\b/i,
  ],
  ['lassi-shake', /\blassi\b|\bshakes?\b|\bsmoothie\b|\bcold coffee\b/i],
  ['sweets', /\brasmalai\b|\brasgulla\b|\bgulab jamun\b|\bladdoo?\b|\bhalwa\b|\bjalebi\b/i],
] as const satisfies readonly (readonly [string, RegExp])[];

export type FoodCategory = (typeof FOOD_CATEGORIES)[number][0];

export function categorize(itemName: string): FoodCategory | null {
  for (const [category, pattern] of FOOD_CATEGORIES) {
    if (pattern.test(itemName)) return category;
  }
  return null;
}
