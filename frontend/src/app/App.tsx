import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  categorize,
  FOOD_CATEGORIES,
  listMonths,
  placeholderNames,
  searchOrders,
  toDisplayName,
  type MonthFilter,
  type OrderLine,
} from '@food-stack/shared';
import { MonthSelect } from '../components/MonthSelect';
import { pileArt, plateArt } from '../features/food-art/registry';
import { FoodPile } from '../features/food-stack/FoodPile';
import type { PileAnimationOptions } from '../features/food-stack/usePileAnimation';
import { Plate } from '../features/search/Plate';
import { SearchField } from '../features/search/SearchField';
import { SearchResult } from '../features/search/SearchResult';
import { usePrefersReducedMotion } from '../hooks/usePrefersReducedMotion';
import { useOrders } from '../hooks/useOrders';
import { demoOrderSource, type OrderSource } from '../services/order-source';
import { INTRO_FAILSAFE_MS } from './intro';

interface AppProps {
  source?: OrderSource;
  /** Test seam: replaces the physics pile. */
  pileOverrides?: Partial<PileAnimationOptions>;
}

export function App({ source = demoOrderSource, pileOverrides }: AppProps) {
  const reducedMotion = usePrefersReducedMotion();
  const { status, orders } = useOrders(source);
  const [query, setQuery] = useState('');
  const [chosenMonth, setChosenMonth] = useState<MonthFilter | null>(null);
  const [ready, setReady] = useState(false);

  const months = useMemo(() => listMonths(orders), [orders]);
  const month: MonthFilter = chosenMonth ?? months[0] ?? 'all';
  const suggestions = useMemo(() => placeholderNames(orders), [orders]);
  const outcome = useMemo(() => searchOrders(orders, query, month), [orders, query, month]);
  const pileWeights = useMemo(() => weightsFor(orders), [orders]);

  const plate = outcome.kind === 'match' ? plateFor(outcome.representative.itemName) : null;

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
            suggestions={suggestions}
            reducedMotion={reducedMotion}
          />
          <SearchResult outcome={outcome} />
        </div>
        <div className="app__right">
          {plate && <Plate key={plate.art.url} art={plate.art} label={plate.label} />}
        </div>
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

/** The plate for a matched item, or null when no artwork fits (never an unrelated picture). */
function plateFor(itemName: string) {
  const category = categorize(itemName);
  const art = category ? plateArt(category) : null;
  return art ? { art, label: toDisplayName(itemName) || itemName } : null;
}

/**
 * Pile image URL → how often it appears, from the quantities ordered. Without order data the
 * collage still shows every food that has artwork, equally weighted.
 */
function weightsFor(orders: readonly OrderLine[]): Map<string, number> {
  const weights = new Map<string, number>();
  for (const line of orders) {
    const category = categorize(line.itemName);
    const art = category ? pileArt(category) : null;
    if (art) weights.set(art.url, (weights.get(art.url) ?? 0) + line.quantity);
  }
  if (weights.size === 0) {
    for (const [category] of FOOD_CATEGORIES) {
      const art = pileArt(category);
      if (art) weights.set(art.url, 1);
    }
  }
  return weights;
}
