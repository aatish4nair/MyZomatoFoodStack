import type { FoodCategory } from '@food-stack/shared';

/**
 * The one place that knows which image belongs to which food category.
 *
 * Final artwork is picked up automatically, by file name, from:
 *   assets/pile/<category>.png    small items for the falling footer collage
 *   assets/plates/<category>.png  plated dish shown on the right after a search
 * (see docs/design/ART-BRIEF.md). Until a file exists there, a temporary placeholder from
 * My Food Pile (assets/food/) is used where a reasonable one exists. Categories with neither
 * are left out of the pile and show no plate, so an unrelated picture is never shown.
 */

type UrlMap = Record<string, string>;
const glob = (files: UrlMap): Map<string, string> =>
  new Map(
    Object.entries(files).map(([path, url]) => [path.replace(/^.*\/|\.png$/g, ''), url] as const),
  );

const finalPile = glob(
  import.meta.glob<string>('../../assets/pile/*.png', {
    eager: true,
    query: '?url',
    import: 'default',
  }),
);
const finalPlates = glob(
  import.meta.glob<string>('../../assets/plates/*.png', {
    eager: true,
    query: '?url',
    import: 'default',
  }),
);
// Only the stand-ins listed in PLACEHOLDER below are bundled (keep the two lists in sync).
const upstream = glob(
  import.meta.glob<string>(
    '../../assets/food/{biryani,burger,cake,coke,dosa,fried-chicken,fries,ice-cream-cup,lassi,pizza,rasmalai,sandwich,shawarma}.png',
    { eager: true, query: '?url', import: 'default' },
  ),
);

/**
 * Temporary stand-ins from My Food Pile (different illustration style). `chai.png` is never used:
 * it has steam rising from it, which the design forbids.
 */
const PLACEHOLDER: Partial<Record<FoodCategory, string>> = {
  'dosa-idli': 'dosa',
  'ice-cream': 'ice-cream-cup',
  'brownie-cake': 'cake',
  pizza: 'pizza',
  burger: 'burger',
  sandwich: 'sandwich',
  'wrap-roll': 'shawarma',
  biryani: 'biryani',
  'tandoori-chicken': 'fried-chicken',
  'fried-chicken': 'fried-chicken',
  fries: 'fries',
  'cold-drink': 'coke',
  'lassi-shake': 'lassi',
  sweets: 'rasmalai',
};

export interface ArtImage {
  url: string;
  /** True while a temporary My Food Pile image stands in for the final artwork. */
  placeholder: boolean;
}

function placeholderFor(category: FoodCategory): ArtImage | null {
  const name = PLACEHOLDER[category];
  const url = name === undefined ? undefined : upstream.get(name);
  return url === undefined ? null : { url, placeholder: true };
}

/** Image for a falling pile item, or null if the category has no artwork yet. */
export function pileArt(category: FoodCategory): ArtImage | null {
  const url = finalPile.get(category);
  return url === undefined ? placeholderFor(category) : { url, placeholder: false };
}

/**
 * Image for the right-hand plate. A placeholder is a single item, so the UI draws it on a plain
 * plate shape until the real plated dish exists.
 */
export function plateArt(category: FoodCategory): ArtImage | null {
  const url = finalPlates.get(category);
  return url === undefined ? placeholderFor(category) : { url, placeholder: false };
}
