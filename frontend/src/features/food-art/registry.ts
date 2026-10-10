import { artFallbacks, foodNameKey, toDisplayName, type FoodCategory } from '@food-stack/shared';

/**
 * The one place that knows which image belongs to which food category.
 *
 * Final artwork is picked up automatically, by file name, from:
 *   assets/pile/<category>.png    small items for the falling footer collage
 *   assets/plates/<category>.png  plated dish shown on the right after a search
 *                                 (plates may also be .jpg, .jpeg, .webp or .avif)
 * (see docs/design/ART-BRIEF.md), using the art keys and fallbacks in
 * shared/src/lib/food-category.ts. Until a file exists, a My Food Pile stand-in is used only if it
 * shows the same dish. Otherwise the pile leaves the dish out and the plate area shows a neutral
 * empty plate, so an unrelated picture is never shown.
 */

type UrlMap = Record<string, string>;
/** Image file extensions accepted for plate artwork. */
const IMAGE_EXT = /\.(?:png|jpe?g|webp|avif)$/i;
const glob = (files: UrlMap): Map<string, string> =>
  new Map(
    Object.entries(files).map(
      ([path, url]) => [path.replace(/^.*\//, '').replace(IMAGE_EXT, ''), url] as const,
    ),
  );

const finalPile = glob(
  import.meta.glob<string>('../../assets/pile/*.png', {
    eager: true,
    query: '?url',
    import: 'default',
  }),
);
const plateFiles = import.meta.glob<string>(
  '../../assets/plates/*.{png,jpg,jpeg,webp,avif,PNG,JPG,JPEG,WEBP,AVIF}',
  {
    eager: true,
    query: '?url',
    import: 'default',
  },
);
const finalPlates = glob(plateFiles);

/**
 * Plate images named after a DISH (e.g. "Chicken Hyderabadi Dum Biryani.png"), indexed by the same
 * normalisation as displayed dish names: the filename is cleaned with `toDisplayName` and compared
 * ignoring case, punctuation, "&"/"and" and word order. Art-key files (`chicken-biryani.png`) are
 * indexed too, harmlessly.
 */
export function buildDishPlateIndex(files: Record<string, string>): Map<string, string> {
  const index = new Map<string, string>();
  for (const [path, url] of Object.entries(files)) {
    const base = path.replace(/^.*\//, '').replace(IMAGE_EXT, '');
    const key = foodNameKey(toDisplayName(base) || base);
    if (key && !index.has(key)) index.set(key, url);
  }
  return index;
}
const dishPlates = buildDishPlateIndex(plateFiles);

/** The plate image made for this exact dish (by its displayed name), or null. */
/**
 * Owner-chosen image reuse: dish (display name) → the dish/file name whose plate image it shares.
 * Used only when the dish has no image of its own.
 */
export const PLATE_ALIASES: Readonly<Record<string, string>> = {
  'Chicken Biryani With Raita Combo': 'Chicken Biryani',
  'Assorted Eggless Brownies': 'Assorted Eggless Brownies Box',
};

export function dishPlateArt(
  displayName: string,
  index = dishPlates,
  aliases: Readonly<Record<string, string>> = PLATE_ALIASES,
): ArtImage | null {
  const key = foodNameKey(displayName);
  const alias = Object.entries(aliases).find(([dish]) => foodNameKey(dish) === key)?.[1];
  const url = index.get(key) ?? (alias === undefined ? undefined : index.get(foodNameKey(alias)));
  return url === undefined ? null : { url, placeholder: false };
}
// Only the stand-ins listed in STAND_IN below are bundled (keep the two lists in sync).
const upstream = glob(
  import.meta.glob<string>(
    '../../assets/food/{biryani,burger,cake,coke,dosa,fried-chicken,fries,garlic-bread,ice-cream-cup,idli,lassi,pizza,rasmalai,sandwich,shawarma,vada}.png',
    { eager: true, query: '?url', import: 'default' },
  ),
);

/**
 * Temporary stand-ins from My Food Pile (a different, toy-like style), used ONLY where the picture
 * shows that same dish. A stand-in is never borrowed by a different dish: tandoori chicken no
 * longer shows the fried drumstick, and idli no longer shows a dosa. `chai.png` is never used
 * (it has steam rising from it).
 */
const STAND_IN: Partial<Record<FoodCategory, string>> = {
  'chicken-biryani': 'biryani',
  'fried-chicken': 'fried-chicken',
  idli: 'idli',
  dosa: 'dosa',
  vada: 'vada',
  pizza: 'pizza',
  'garlic-bread': 'garlic-bread',
  burger: 'burger',
  sandwich: 'sandwich',
  'wrap-roll': 'shawarma',
  fries: 'fries',
  'cold-drink': 'coke',
  'ice-cream': 'ice-cream-cup',
  'brownie-cake': 'cake',
  lassi: 'lassi',
  rasmalai: 'rasmalai',
};

export interface ArtImage {
  url: string;
  /** True while a temporary My Food Pile image stands in for the final artwork. */
  placeholder: boolean;
}

function standInFor(category: FoodCategory): ArtImage | null {
  const name = STAND_IN[category];
  const url = name === undefined ? undefined : upstream.get(name);
  return url === undefined ? null : { url, placeholder: true };
}

/**
 * Lookup order: final artwork for the dish (e.g. `chicken-biryani`), then final artwork for its
 * category-level fallback (`biryani`), then a stand-in that shows this exact dish. Otherwise null.
 */
function lookup(category: FoodCategory, finals: Map<string, string>): ArtImage | null {
  for (const key of artFallbacks(category)) {
    const url = finals.get(key);
    if (url !== undefined) return { url, placeholder: false };
  }
  return standInFor(category);
}

/** Image for a falling pile item, or null if the dish has no suitable artwork yet. */
export function pileArt(category: FoodCategory): ArtImage | null {
  return lookup(category, finalPile);
}

/**
 * Image for the right-hand plate, or null. With null the UI shows a neutral empty plate for a
 * matched food (never an unrelated dish). A stand-in is a single item, so the UI draws it on a
 * plain plate shape until the real plated dish exists.
 */
export function plateArt(category: FoodCategory): ArtImage | null {
  return lookup(category, finalPlates);
}
