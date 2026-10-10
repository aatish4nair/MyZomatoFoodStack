import {
  inMonth,
  isCountedOrder,
  type Insights,
  type MonthFilter,
  type Order,
} from '@food-stack/shared';

/**
 * The four metrics. Orders are already one-per-order-ID, so nothing is double-counted.
 * - A, total spending: sum of counted orders' totals, in integer paise.
 * - B, total orders: distinct counted (successful) order IDs.
 * - C, average spending: total spending ÷ counted orders WITH a known total, rounded to the nearest
 *   paisa; null when there are none (never a division by zero).
 * - D, most-ordered restaurant: the restaurant name(s) with the most counted orders. Ties return
 *   every tied name, sorted A→Z. Names are compared exactly as written in the sheet.
 * Unsuccessful and unknown-status orders are excluded and counted in `basis`.
 */
export function computeInsights(
  orders: readonly Order[],
  month: MonthFilter,
): Omit<Insights, 'freshness'> {
  const inRange = orders.filter((o) => inMonth(o, month));
  const counted = [...new Map(inRange.filter(isCountedOrder).map((o) => [o.orderId, o])).values()];
  const withTotal = counted.filter((o) => o.totalPaidPaise !== null);
  const totalSpendingPaise = withTotal.reduce((sum, o) => sum + (o.totalPaidPaise ?? 0), 0);

  const perRestaurant = new Map<string, number>();
  for (const order of counted)
    perRestaurant.set(order.restaurant, (perRestaurant.get(order.restaurant) ?? 0) + 1);
  const top = Math.max(0, ...perRestaurant.values());
  const leaders = [...perRestaurant]
    .filter(([, count]) => count === top)
    .map(([name]) => name)
    .sort((a, b) => a.localeCompare(b, 'en'));

  return {
    month,
    totalSpendingPaise,
    totalOrders: counted.length,
    averageSpendingPaise:
      withTotal.length > 0 ? Math.round(totalSpendingPaise / withTotal.length) : null,
    mostOrderedRestaurant: top > 0 ? { restaurants: leaders, orderCount: top } : null,
    basis: {
      ordersWithKnownTotal: withTotal.length,
      ordersMissingTotal: counted.length - withTotal.length,
      excludedUnsuccessful: inRange.filter((o) => o.statusCategory === 'unsuccessful').length,
      excludedUnknownStatus: inRange.filter((o) => o.statusCategory === 'unknown').length,
    },
  };
}
