import { z } from 'zod';
import { DataFreshnessSchema } from './api.js';
import { MonthFilterSchema } from './order.js';

/**
 * Summary for the result panel (count, food name, amount paid, restaurant, order date, quantity).
 * Amounts are whole paise.
 */
/** One dish within a result, with the original item names it was ordered as. */
export const ResultVariantSchema = z.object({
  /** Display name (Dish Type). */
  name: z.string(),
  orderCount: z.number().int().positive(),
  /** Total quantity, or null when any quantity is unknown. */
  quantity: z.number().int().nonnegative().nullable(),
  /** Original Item Names exactly as in the sheet. */
  originalNames: z.array(z.string()).min(1),
});

export const SearchSummarySchema = z.object({
  /** The picked category or dish name. */
  query: z.string(),
  month: MonthFilterSchema,
  /** Whether a whole Dish Category or a single dish was picked. */
  selection: z.enum(['category', 'dish']),
  /** Distinct orders containing a matching item. */
  matchingOrderCount: z.number().int().nonnegative(),
  /** Heading: the dish's display name, or "<Category> · All variants". */
  foodName: z.string(),
  /**
   * Sum of Total Paid over the matching orders that contain ONLY the picked category/dish and
   * have a known total. Orders that also contain other dishes are excluded: the sheet has no item
   * prices, so their total can't be attributed.
   */
  totalPaidPaise: z.number().int().nonnegative(),
  /** How many orders `totalPaidPaise` covers. */
  pricedOrderCount: z.number().int().nonnegative(),
  /** Orders containing only the selection but with no known total. */
  ordersMissingTotal: z.number().int().nonnegative(),
  /** Matching orders that also contain other dishes (counted, but not in the amount). */
  ordersWithOtherItems: z.number().int().nonnegative(),
  restaurant: z.string().nullable(),
  /** Date of the most recent matching order, `YYYY-MM-DD`. */
  orderDate: z.iso.date().nullable(),
  /** Total quantity of matching items, or null when any matching item's quantity is unknown. */
  totalQuantity: z.number().int().nonnegative().nullable(),
  /** Breakdown by dish, most-ordered first. */
  variants: z.array(ResultVariantSchema),
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
