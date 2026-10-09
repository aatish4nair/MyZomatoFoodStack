import { z } from 'zod';
import { MonthFilterSchema } from './order.js';

/**
 * Draft contract for the search summary shown on the left of the page
 * (count, food name, amount paid, restaurant, order date, quantity).
 * It will be finalised in Phase 1 against the approved design.
 */
export const SearchSummarySchema = z.object({
  query: z.string(),
  month: MonthFilterSchema,
  matchingOrderCount: z.number().int().nonnegative(),
  /** Display name of the matched food (bracketed suffixes removed). */
  foodName: z.string(),
  totalPaid: z.number().nonnegative(),
  restaurant: z.string().nullable(),
  /** Date of the most recent matching order, `YYYY-MM-DD`. */
  orderDate: z.iso.date().nullable(),
  totalQuantity: z.number().int().nonnegative(),
});
export type SearchSummary = z.infer<typeof SearchSummarySchema>;
