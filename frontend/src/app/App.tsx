import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  categorize,
  FOOD_CATEGORIES,
  isCountedOrder,
  listMonths,
  placeholderNames,
  searchOrders,
  toDisplayName,
  type MonthFilter,
  type Order,
} from '@food-stack/shared';
import { MonthSelect } from '../components/MonthSelect';
import { dishPlateArt, pileArt, plateArt } from '../features/food-art/registry';
import { FoodPile } from '../features/food-stack/FoodPile';
import type { PileAnimationOptions } from '../features/food-stack/usePileAnimation';
import { Plate } from '../features/search/Plate';
import { SearchField } from '../features/search/SearchField';
import { SearchResult } from '../features/search/SearchResult';
import { usePrefersReducedMotion } from '../hooks/usePrefersReducedMotion';
import { useOrders } from '../hooks/useOrders';
import { defaultOrderSource, type OrderSource } from '../services/order-source';
import { INTRO_FAILSAFE_MS } from './intro';

interface AppProps {
  source?: OrderSource;
  /** Test seam: replaces the physics pile. */
  pileOverrides?: Partial<PileAnimationOptions>;
}

const DEFAULT_SOURCE = defaultOrderSource();

export function App({ source = DEFAULT_SOURCE, pileOverrides }: AppProps) {
  const reducedMotion = usePrefersReducedMotion();
  const { status, orders } = useOrders(source);
  const [query, setQuery] = useState('');
  const [chosenMonth, setChosenMonth] = useState<MonthFilter | null>(null);
  const [ready, setReady] = useState(false);
  const searchInput = useRef<HTMLInputElement>(null);

  const months = useMemo(() => listMonths(orders), [orders]);
  const month: MonthFilter = chosenMonth ?? months[0] ?? 'all';
  const suggestions = useMemo(() => placeholderNames(orders), [orders]);
  const outcome = useMemo(() => searchOrders(orders, query, month), [orders, query, month]);
  const pileWeights = useMemo(() => weightsFor(orders), [orders]);

  const plate = outcome.kind === 'match' ? plateFor(outcome.representative.item.name) : null;

  const reveal = useCallback(() => {
    setReady(true);
  }, []);
  useEffect(() => {
    const timer = setTimeout(reveal, INTRO_FAILSAFE_MS);
    return () => {
      clearTimeout(timer);
    };
  }, [reveal]);

  return (
    <div className={`app${ready ? ' app--ready' : ''}`}>
      <main className="app__content" inert={!ready}>
        <div className="app__left">
          <header className="app__header">
            <h1 className="app__title">
              My <span className="app__brand">Zomato</span> food Stack
            </h1>
            <MonthSelect months={months} value={month} onChange={setChosenMonth} />
          </header>
          <SearchField
            value={query}
            onChange={setQuery}
            inputRef={searchInput}
            suggestions={suggestions}
            reducedMotion={reducedMotion}
          />
          {status === 'unavailable' ? (
            <p className="load-error" role="status">
              Your orders couldn’t be loaded right now. Please try again later.
            </p>
          ) : (
            <SearchResult
              outcome={outcome}
              onSelectVariant={(name) => {
                // Picking a variant searches its exact name, which resolves to that food directly.
                setQuery(name);
                searchInput.current?.focus();
              }}
            />
          )}
        </div>
        <div className="app__right">{plate && <Plate art={plate.art} label={plate.label} />}</div>
      </main>
      {status === 'loading' ? (
        // Reserve the footer space; the drop starts once the data is known, so it runs only once.
        <div className="food-pile" aria-hidden="true" />
      ) : (
        <FoodPile
          weights={pileWeights}
          reducedMotion={reducedMotion}
          onSettled={reveal}
          {...pileOverrides}
        />
      )}
    </div>
  );
}

/**
 * The plate for a matched item: its artwork, or `art: null` (a neutral empty plate) when no
 * suitable picture exists yet. Never an unrelated dish.
 */
function plateFor(itemName: string) {
  const label = toDisplayName(itemName) || itemName;
  // The dish's own image first, then its art-key image or exact-dish stand-in, else the empty plate.
  const category = categorize(itemName);
  return { art: dishPlateArt(label) ?? (category ? plateArt(category) : null), label };
}

/**
 * Pile image URL → how often it appears, from the quantities ordered. Without order data the
 * collage still shows every food that has artwork, equally weighted.
 */
function weightsFor(orders: readonly Order[]): Map<string, number> {
  const weights = new Map<string, number>();
  for (const item of orders.filter(isCountedOrder).flatMap((o) => o.items)) {
    const category = categorize(item.name);
    const art = category ? pileArt(category) : null;
    if (art) weights.set(art.url, (weights.get(art.url) ?? 0) + (item.quantity ?? 1));
  }
  if (weights.size === 0) {
    for (const category of FOOD_CATEGORIES) {
      const art = pileArt(category);
      if (art) weights.set(art.url, 1);
    }
  }
  return weights;
}
