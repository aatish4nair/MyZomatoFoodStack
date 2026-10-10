import { z } from 'zod';
import { DataFreshnessSchema } from './api.js';
import { MonthFilterSchema } from './order.js';

/**
 * Summary for the result panel (count, food name, amount paid, restaurant, order date, quantity).
 * Amounts are whole paise.
 */
export const SearchSummarySchema = z.object({
  query: z.string(),
  month: MonthFilterSchema,
  /** Distinct orders containing a matching item. */
  matchingOrderCount: z.number().int().nonnegative(),
  /** Display name of the matched food (bracketed text removed). */
  foodName: z.string(),
  /** Sum of the whole-order totals of the matching orders whose total is known. */
  totalPaidPaise: z.number().int().nonnegative(),
  /** How many matching orders have no known total (so the amount may be incomplete). */
  ordersMissingTotal: z.number().int().nonnegative(),
  restaurant: z.string().nullable(),
  /** Date of the most recent matching order, `YYYY-MM-DD`. */
  orderDate: z.iso.date().nullable(),
  /** Total quantity of matching items, or null when any matching item's quantity is unknown. */
  totalQuantity: z.number().int().nonnegative().nullable(),
});
export type SearchSummary = z.infer<typeof SearchSummarySchema>;

/** The four spending metrics. Calculated by the backend; not shown in the main interface. */
export const InsightsSchema = z.object({
  month: MonthFilterSchema,
  /** Metric A: sum of each counted order's total, once per order ID (paise). */
  totalSpendingPaise: z.number().int().nonnegative(),
  /** Metric B: distinct successful order IDs. */
  totalOrders: z.number().int().nonnegative(),
  /** Metric C: total spending ÷ orders with a known total (paise, rounded); null with no such orders. */
  averageSpendingPaise: z.number().int().nonnegative().nullable(),
  /** Metric D: restaurant(s) with the most distinct successful orders; ties list all, A→Z. */
  mostOrderedRestaurant: z
    .object({
      restaurants: z.array(z.string()).min(1),
      orderCount: z.number().int().positive(),
    })
    .nullable(),
  /** What the numbers are based on, so limitations are visible rather than hidden. */
  basis: z.object({
    ordersWithKnownTotal: z.number().int().nonnegative(),
    ordersMissingTotal: z.number().int().nonnegative(),
    excludedUnsuccessful: z.number().int().nonnegative(),
    excludedUnknownStatus: z.number().int().nonnegative(),
  }),
  freshness: DataFreshnessSchema,
});
export type Insights = z.infer<typeof InsightsSchema>;
