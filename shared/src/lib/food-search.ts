import type { MonthFilter, OrderLine } from '../contracts/order.js';
import type { SearchSummary } from '../contracts/insights.js';
import { toDisplayName } from './display-name.js';

export type SearchOutcome =
  | { kind: 'idle' }
  | { kind: 'none'; query: string; month: MonthFilter }
  | { kind: 'match'; summary: SearchSummary; representative: OrderLine };

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

export function inMonth(line: OrderLine, month: MonthFilter): boolean {
  return month === 'all' || line.orderDate.startsWith(`${month}-`);
}

/** Months that have orders, newest first, as `YYYY-MM`. */
export function listMonths(lines: readonly OrderLine[]): string[] {
  return [...new Set(lines.map((line) => line.orderDate.slice(0, 7)))].sort().reverse();
}

const newestFirst = (a: OrderLine, b: OrderLine): number =>
  `${b.orderDate} ${b.orderTime}`.localeCompare(`${a.orderDate} ${a.orderTime}`);

/**
 * Summary for the result panel. The representative (most recent) matching line supplies the
 * food name, restaurant and date; counts and amounts cover every matching line in the month.
 */
export function searchOrders(
  lines: readonly OrderLine[],
  query: string,
  month: MonthFilter,
): SearchOutcome {
  const trimmed = query.trim();
  if (!trimmed) return { kind: 'idle' };

  const hits = lines.filter((l) => inMonth(l, month) && matchesQuery(l.itemName, trimmed));
  const representative = [...hits].sort(newestFirst)[0];
  if (!representative) return { kind: 'none', query: trimmed, month };

  const totalPaid = hits.reduce((sum, l) => sum + l.totalPaid, 0);
  return {
    kind: 'match',
    representative,
    summary: {
      query: trimmed,
      month,
      matchingOrderCount: new Set(hits.map((l) => l.orderId)).size,
      foodName: toDisplayName(representative.itemName) || representative.itemName,
      totalPaid: Math.round(totalPaid * 100) / 100,
      restaurant: representative.restaurant,
      orderDate: representative.orderDate,
      totalQuantity: hits.reduce((sum, l) => sum + l.quantity, 0),
    },
  };
}

/**
 * Food names for the animated search placeholder: display names (brackets removed), without
 * duplicates, most-ordered first. The original lines are not modified.
 */
export function placeholderNames(lines: readonly OrderLine[]): string[] {
  const counts = new Map<string, { name: string; count: number }>();
  for (const line of lines) {
    const name = toDisplayName(line.itemName);
    if (!name) continue;
    const key = name.toLowerCase();
    const entry = counts.get(key) ?? { name, count: 0 };
    entry.count += line.quantity;
    counts.set(key, entry);
  }
  return [...counts.values()]
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
    .map((entry) => entry.name);
}
