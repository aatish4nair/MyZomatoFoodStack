import type { MonthFilter, Order, OrderItem } from '../contracts/order.js';
import type { SearchSummary } from '../contracts/insights.js';
import { toDisplayName } from './display-name.js';
import { isCountedOrder } from './order-status.js';

/** One food the user might mean: a distinct display name, with how many orders contain it. */
export interface VariantOption {
  name: string;
  orderCount: number;
}

/** At most this many variants are offered at once; the rest are summarised as "more". */
export const MAX_VARIANT_OPTIONS = 8;

export type SearchOutcome =
  | { kind: 'idle' }
  | { kind: 'none'; query: string; month: MonthFilter }
  | {
      kind: 'clarify';
      query: string;
      month: MonthFilter;
      /** Most-ordered first. */
      options: VariantOption[];
      /** Matching variants not listed (the user can type more to narrow down). */
      moreCount: number;
    }
  | {
      kind: 'match';
      summary: SearchSummary;
      /** The most recent matching order and the matching item in it (original name intact). */
      representative: { order: Order; item: OrderItem };
    };

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

export function inMonth(order: Pick<Order, 'orderDate'>, month: MonthFilter): boolean {
  return month === 'all' || order.orderDate.startsWith(`${month}-`);
}

/** Months that have counted orders, newest first, as `YYYY-MM`. */
export function listMonths(orders: readonly Order[]): string[] {
  return [...new Set(orders.filter(isCountedOrder).map((o) => o.orderDate.slice(0, 7)))]
    .sort()
    .reverse();
}

const newestFirst = (a: Order, b: Order): number =>
  `${b.orderDate} ${b.orderTime ?? ''}`.localeCompare(`${a.orderDate} ${a.orderTime ?? ''}`) ||
  a.orderId.localeCompare(b.orderId);

/** The food as shown to the user: the original name without bracketed text. */
const displayNameOf = (item: OrderItem): string => toDisplayName(item.name) || item.name;

/**
 * Identity of a (display) food name, ignoring case, punctuation, "&" vs "and" and word order:
 * "Chicken Tandoori" ≡ "Tandoori Chicken" ≡ "tandoori-chicken". Used to group variants and to match
 * plate image files to dishes.
 */
export const foodNameKey = (name: string): string =>
  words(name.replace(/&/g, ' and ')).sort().join(' ');
const variantKey = foodNameKey;

const countedIn = (orders: readonly Order[], month: MonthFilter): Order[] =>
  orders.filter((o) => isCountedOrder(o) && inMonth(o, month));

/**
 * The distinct foods (by display name, brackets removed) whose ORIGINAL name matches the query,
 * among counted orders in the month. "Chicken Biryani (Serves 1)" and "Chicken Biryani [Boneless]"
 * are the same food. Most-ordered first, then A→Z.
 */
export function findVariants(
  orders: readonly Order[],
  query: string,
  month: MonthFilter,
): VariantOption[] {
  const variants = new Map<string, { name: string; orderIds: Set<string> }>();
  for (const order of countedIn(orders, month)) {
    for (const item of order.items) {
      if (!matchesQuery(item.name, query)) continue;
      const name = displayNameOf(item);
      const key = variantKey(name);
      const entry = variants.get(key) ?? { name, orderIds: new Set<string>() };
      entry.orderIds.add(order.orderId);
      variants.set(key, entry);
    }
  }
  return [...variants.values()]
    .map((v) => ({ name: v.name, orderCount: v.orderIds.size }))
    .sort((a, b) => b.orderCount - a.orderCount || a.name.localeCompare(b.name));
}

/**
 * Resolves what the user typed:
 * - no matching food → `none`;
 * - the words typed are exactly one food's name (any word order, e.g. "chicken tandoori"), or only
 *   one food matches → `match` for that food;
 * - several foods match a more generic query (e.g. "biryani" → Chicken / Mutton / Veg Biryani) →
 *   `clarify`, offering the real variants from the order data.
 *
 * A match covers one food only. Orders are counted once each (by order ID). The amount is the sum
 * of those orders' totals; the sheet has no per-item prices, so an order's total includes any
 * other items in it. The most recent order supplies the restaurant and date.
 */
export function searchOrders(
  orders: readonly Order[],
  query: string,
  month: MonthFilter,
): SearchOutcome {
  const trimmed = query.trim();
  if (!trimmed) return { kind: 'idle' };

  const variants = findVariants(orders, trimmed, month);
  if (variants.length === 0) return { kind: 'none', query: trimmed, month };
  const typedKey = variantKey(trimmed);
  const chosen =
    variants.find((v) => variantKey(v.name) === typedKey) ??
    (variants.length === 1 ? variants[0] : undefined);
  if (!chosen) {
    return {
      kind: 'clarify',
      query: trimmed,
      month,
      options: variants.slice(0, MAX_VARIANT_OPTIONS),
      moreCount: Math.max(0, variants.length - MAX_VARIANT_OPTIONS),
    };
  }

  const chosenKey = variantKey(chosen.name);
  const hits = countedIn(orders, month)
    .map((order) => ({
      order,
      items: order.items.filter((i) => variantKey(displayNameOf(i)) === chosenKey),
    }))
    .filter((hit) => hit.items.length > 0)
    .sort((a, b) => newestFirst(a.order, b.order));

  const first = hits[0];
  const firstItem = first?.items[0];
  if (!first || !firstItem) return { kind: 'none', query: trimmed, month };

  const quantities = hits.flatMap((h) => h.items).map((i) => i.quantity);
  const known = hits.filter((h) => h.order.totalPaidPaise !== null);

  return {
    kind: 'match',
    representative: { order: first.order, item: firstItem },
    summary: {
      query: trimmed,
      month,
      matchingOrderCount: hits.length,
      foodName: chosen.name,
      totalPaidPaise: known.reduce((sum, h) => sum + (h.order.totalPaidPaise ?? 0), 0),
      ordersMissingTotal: hits.length - known.length,
      restaurant: first.order.restaurant,
      orderDate: first.order.orderDate,
      totalQuantity: quantities.every((q) => q !== null)
        ? quantities.reduce((sum, q) => sum + q, 0)
        : null,
    },
  };
}

/**
 * Food names for the animated search placeholder: display names (brackets removed) from counted
 * orders, without duplicates, most-ordered first. The original data is not modified.
 */
export function placeholderNames(orders: readonly Order[]): string[] {
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
