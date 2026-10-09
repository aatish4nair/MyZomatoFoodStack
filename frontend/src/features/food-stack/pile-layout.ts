/** Pure sizing maths for the footer pile, kept separate from physics and React so it is testable. */

export interface PileLayout {
  /** Typical on-screen size of one item (its longer side), in CSS pixels. */
  itemSize: number;
  /** How many items to drop so the settled pile fills the footer zone densely. */
  itemCount: number;
}

export const MIN_ITEM_SIZE = 40;
export const MAX_ITEM_SIZE = 92;
export const MAX_ITEMS = 220;

/**
 * Items scale with the viewport width (about 5.5% of it, within limits) so they stay small
 * relative to the page. The count fills the zone area with ~15% extra; items that end up above
 * the zone are removed after settling, which keeps the top edge dense but never over the UI.
 */
export function computePileLayout(width: number, zoneHeight: number): PileLayout {
  if (width <= 0 || zoneHeight <= 0) return { itemSize: MIN_ITEM_SIZE, itemCount: 0 };
  const itemSize = Math.round(Math.min(MAX_ITEM_SIZE, Math.max(MIN_ITEM_SIZE, width * 0.055)));
  // Settled items cover roughly 55% of their bounding square once they interlock.
  const footprint = itemSize * itemSize * 0.55;
  const itemCount = Math.min(MAX_ITEMS, Math.ceil(((width * zoneHeight) / footprint) * 1.15));
  return { itemSize, itemCount };
}

/** Small deterministic random number generator (mulberry32) so layouts are reproducible in tests. */
export function seededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Chooses which artwork each dropped item uses. Every available kind appears at least once (for
 * a colourful collage), then the rest follow the weights (how often each food was ordered).
 */
export function choosePileItems<K extends string>(
  weights: ReadonlyMap<K, number>,
  count: number,
  random: () => number,
): K[] {
  const kinds = [...weights.keys()].filter((k) => (weights.get(k) ?? 0) > 0);
  if (kinds.length === 0 || count <= 0) return [];
  const total = kinds.reduce((sum, k) => sum + (weights.get(k) ?? 0), 0);
  const picked: K[] = kinds.slice(0, count);
  while (picked.length < count) {
    let r = random() * total;
    const kind = kinds.find((k) => (r -= weights.get(k) ?? 0) < 0) ?? kinds.at(-1);
    if (kind === undefined) break;
    picked.push(kind);
  }
  // Shuffle so the first-of-each-kind items don't all fall together.
  for (let i = picked.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    const a = picked[i];
    const b = picked[j];
    if (a !== undefined && b !== undefined) {
      picked[i] = b;
      picked[j] = a;
    }
  }
  return picked;
}
