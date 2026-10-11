import type { MonthFilter, OrderItem, SearchableOrder } from '../contracts/order.js';
import type { SearchSummary } from '../contracts/insights.js';
import { foodNameKey, toDisplayName } from './display-name.js';

export { foodNameKey };
import { isCountedOrder } from './order-status.js';
import {
  CATEGORY_SEARCH_TERMS,
  categorizeDish,
  dishTypeOf,
  type DishCategory,
} from './dish-category.js';

const words = (text: string): string[] =>
  text
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean);

/**
 * True when every word typed matches the start of some word in the item name, in any order:
 * "chicken tandoori" and "tando" both match "Tandoori Chicken (breast Pcs)", but "lassi" does not
 * match "Classic". Matching always uses the original name, brackets included.
 */
export function matchesQuery(itemName: string, query: string): boolean {
  const queryWords = words(query);
  if (queryWords.length === 0) return false;
  const nameWords = words(itemName);
  return queryWords.every((q) => nameWords.some((w) => w.startsWith(q)));
}

export function inMonth(order: Pick<SearchableOrder, 'orderDate'>, month: MonthFilter): boolean {
  return month === 'all' || order.orderDate.startsWith(`${month}-`);
}

/** Months that have counted orders, newest first, as `YYYY-MM`. */
export function listMonths(orders: readonly SearchableOrder[]): string[] {
  return [...new Set(orders.filter(isCountedOrder).map((o) => o.orderDate.slice(0, 7)))]
    .sort()
    .reverse();
}

/**
 * Newest first: by date, then by ID. Public order IDs are assigned oldest → newest, so on the same
 * day the later order comes first without the API exposing the time of day.
 */
const newestFirst = (a: SearchableOrder, b: SearchableOrder): number =>
  b.orderDate.localeCompare(a.orderDate) ||
  b.orderId.localeCompare(a.orderId, 'en', { numeric: true });

const countedIn = (orders: readonly SearchableOrder[], month: MonthFilter): SearchableOrder[] =>
  orders.filter((o) => isCountedOrder(o) && inMonth(o, month));

/** What the user picked from the suggestions: a whole category, or one dish (Dish Type). */
export type SearchSelection =
  { kind: 'category'; category: DishCategory } | { kind: 'dish'; key: string; name: string };

/** One autocomplete suggestion. Typing never selects one; the user picks it explicitly. */
export type Suggestion =
  | {
      kind: 'category';
      category: DishCategory;
      /** "Biryani · All variants" */
      label: string;
      dishCount: number;
      orderCount: number;
    }
  | { kind: 'dish'; key: string; name: string; category: DishCategory; orderCount: number };

export const MAX_CATEGORY_SUGGESTIONS = 3;
export const MAX_DISH_SUGGESTIONS = 8;

export const categoryLabel = (category: DishCategory): string => `${category} · All variants`;

/** True when every word typed starts a word of the category's name or one of its search terms. */
function categoryMatches(category: DishCategory, query: string): boolean {
  const queryWords = words(query);
  if (queryWords.length === 0) return false;
  const vocabulary = [category, ...(CATEGORY_SEARCH_TERMS[category] ?? [])].flatMap(words);
  return queryWords.every((q) => vocabulary.some((w) => w.startsWith(q)));
}

interface DishStats {
  key: string;
  name: string;
  category: DishCategory;
  orderIds: Set<string>;
}

/** Dishes (Dish Types) in the counted orders of the month, with the orders that contain them. */
function dishesIn(orders: readonly SearchableOrder[], month: MonthFilter): Map<string, DishStats> {
  const dishes = new Map<string, DishStats>();
  for (const order of countedIn(orders, month)) {
    for (const item of order.items) {
      const { key, name } = dishTypeOf(item.name);
      const entry = dishes.get(key) ?? {
        key,
        name,
        category: categorizeDish(item.name),
        orderIds: new Set<string>(),
      };
      entry.orderIds.add(order.orderId);
      dishes.set(key, entry);
    }
  }
  return dishes;
}

const byOrdersThenName = (
  a: { orderCount: number; name: string },
  b: { orderCount: number; name: string },
): number => b.orderCount - a.orderCount || a.name.localeCompare(b.name);

/**
 * Autocomplete for what the user has typed, within the selected month (or all months):
 * - categories whose name or search terms match ("bir" → "Biryani · All variants"), first;
 * - then individual dishes whose ORIGINAL item name matches word by word (`matchesQuery`), one
 *   entry per Dish Type, so pack sizes, brackets, case and word order don't create duplicates.
 * Only foods that were actually ordered in the range are offered. Most-ordered first.
 */
export function suggest(
  orders: readonly SearchableOrder[],
  query: string,
  month: MonthFilter,
): Suggestion[] {
  const trimmed = query.trim();
  if (!trimmed) return [];
  const dishes = dishesIn(orders, month);
  const matchingKeys = new Set<string>();
  for (const order of countedIn(orders, month)) {
    for (const item of order.items) {
      if (matchesQuery(item.name, trimmed)) matchingKeys.add(dishTypeOf(item.name).key);
    }
  }

  const categories = new Map<DishCategory, { dishes: number; orderIds: Set<string> }>();
  for (const dish of dishes.values()) {
    const entry = categories.get(dish.category) ?? { dishes: 0, orderIds: new Set<string>() };
    entry.dishes++;
    for (const id of dish.orderIds) entry.orderIds.add(id);
    categories.set(dish.category, entry);
  }
  const categorySuggestions: Suggestion[] = [...categories]
    .filter(([category]) => category !== 'Other' && categoryMatches(category, trimmed))
    .map(([category, entry]) => ({
      kind: 'category' as const,
      category,
      label: categoryLabel(category),
      dishCount: entry.dishes,
      orderCount: entry.orderIds.size,
    }))
    .sort((a, b) => byOrdersThenName({ ...a, name: a.label }, { ...b, name: b.label }))
    .slice(0, MAX_CATEGORY_SUGGESTIONS);

  const dishSuggestions: Suggestion[] = [...dishes.values()]
    .filter((dish) => matchingKeys.has(dish.key))
    .map((dish) => ({
      kind: 'dish' as const,
      key: dish.key,
      name: dish.name,
      category: dish.category,
      orderCount: dish.orderIds.size,
    }))
    .sort(byOrdersThenName)
    .slice(0, MAX_DISH_SUGGESTIONS);

  return [...categorySuggestions, ...dishSuggestions];
}

export const selectionOf = (suggestion: Suggestion): SearchSelection =>
  suggestion.kind === 'category'
    ? { kind: 'category', category: suggestion.category }
    : { kind: 'dish', key: suggestion.key, name: suggestion.name };

/** Text shown in the search field once a suggestion is picked. */
export const selectionText = (selection: SearchSelection): string =>
  selection.kind === 'category' ? selection.category : selection.name;

export type SearchOutcome =
  | { kind: 'idle' }
  | { kind: 'none'; label: string; month: MonthFilter }
  | {
      kind: 'match';
      summary: SearchSummary;
      /** The item whose picture represents the result (original name intact). */
      representative: { order: SearchableOrder; item: OrderItem };
    };

const belongsTo = (selection: SearchSelection) =>
  selection.kind === 'dish'
    ? (item: OrderItem) => dishTypeOf(item.name).key === selection.key
    : (item: OrderItem) => categorizeDish(item.name) === selection.category;

/**
 * Results for a picked category or dish, among counted orders in the month (or all months):
 * - every order containing it is counted once (by order ID);
 * - the quantity is the sum over the matching items (null if any quantity is unknown);
 * - the amount uses ONLY orders in which every item belongs to the selection. The sheet's Total
 *   Paid covers the whole order and there are no item prices, so an order that also contains
 *   other dishes is counted but its amount is left out (and reported), never attributed;
 * - the most recent order supplies the restaurant and date; `variants` breaks the result down by
 *   dish, with the original item names behind each.
 * A category's picture comes from its most-ordered dish; a dish's from its most recent order.
 */
export function searchSelection(
  orders: readonly SearchableOrder[],
  selection: SearchSelection,
  month: MonthFilter,
): SearchOutcome {
  const belongs = belongsTo(selection);
  const hits = countedIn(orders, month)
    .map((order) => ({ order, items: order.items.filter(belongs) }))
    .filter((hit) => hit.items.length > 0)
    .sort((a, b) => newestFirst(a.order, b.order));
  const label = selection.kind === 'category' ? selection.category : selection.name;
  const first = hits[0];
  if (!first) return { kind: 'none', label, month };

  const variants = new Map<
    string,
    {
      name: string;
      orderIds: Set<string>;
      quantities: (number | null)[];
      originalNames: Set<string>;
      latest: { order: SearchableOrder; item: OrderItem };
    }
  >();
  for (const hit of hits) {
    for (const item of hit.items) {
      const { key, name } = dishTypeOf(item.name);
      const entry = variants.get(key) ?? {
        name,
        orderIds: new Set<string>(),
        quantities: [],
        originalNames: new Set<string>(),
        latest: { order: hit.order, item }, // hits are newest first
      };
      entry.orderIds.add(hit.order.orderId);
      entry.quantities.push(item.quantity);
      entry.originalNames.add(item.name);
      variants.set(key, entry);
    }
  }
  const sum = (values: readonly (number | null)[]): number | null => {
    let total = 0;
    for (const quantity of values) {
      if (quantity === null) return null; // one unknown quantity makes the total unknown
      total += quantity;
    }
    return total;
  };
  const variantList = [...variants.values()]
    .map((v) => ({ ...v, orderCount: v.orderIds.size }))
    .sort(byOrdersThenName);

  const exclusive = hits.filter((hit) => hit.items.length === hit.order.items.length);
  const priced = exclusive.filter((hit) => hit.order.totalPaidPaise !== null);
  const representative =
    selection.kind === 'category'
      ? (variantList[0]?.latest ?? { order: first.order, item: first.items[0] as OrderItem })
      : { order: first.order, item: first.items[0] as OrderItem };

  return {
    kind: 'match',
    representative,
    summary: {
      query: label,
      month,
      selection: selection.kind,
      matchingOrderCount: hits.length,
      foodName: selection.kind === 'category' ? categoryLabel(selection.category) : selection.name,
      totalPaidPaise: priced.reduce((total, hit) => total + (hit.order.totalPaidPaise ?? 0), 0),
      pricedOrderCount: priced.length,
      ordersMissingTotal: exclusive.length - priced.length,
      ordersWithOtherItems: hits.length - exclusive.length,
      restaurant: first.order.restaurant,
      orderDate: first.order.orderDate,
      totalQuantity: sum(hits.flatMap((hit) => hit.items.map((item) => item.quantity))),
      variants: variantList.map((v) => ({
        name: v.name,
        orderCount: v.orderCount,
        quantity: sum(v.quantities),
        originalNames: [...v.originalNames].sort(),
      })),
    },
  };
}

/**
 * Food names for the animated search placeholder: display names (brackets removed) from counted
 * orders, without duplicates, most-ordered first. The original data is not modified.
 */
export function placeholderNames(orders: readonly SearchableOrder[]): string[] {
  const counts = new Map<string, { name: string; count: number }>();
  for (const order of orders) {
    if (!isCountedOrder(order)) continue;
    for (const item of order.items) {
      const name = toDisplayName(item.name);
      if (!name) continue;
      const key = name.toLowerCase();
      const entry = counts.get(key) ?? { name, count: 0 };
      entry.count += item.quantity ?? 1;
      counts.set(key, entry);
    }
  }
  return [...counts.values()]
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
    .map((entry) => entry.name);
}
