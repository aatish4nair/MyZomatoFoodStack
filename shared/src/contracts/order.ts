import { z } from 'zod';

/**
 * One line item from a Zomato order, as exposed by the backend API.
 *
 * Mirrors the "Formatted Data" sheet columns, minus fields the frontend never
 * needs: the sheet's row number ("S. No.") and the Gmail Message ID stay
 * server-side.
 */
export const OrderLineSchema = z.object({
  orderId: z.string().min(1),
  /** Calendar date of the order, `YYYY-MM-DD`. */
  orderDate: z.iso.date(),
  /** Local time of the order, `HH:mm`. */
  orderTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Expected HH:mm'),
  restaurant: z.string().min(1),
  /** The item name exactly as recorded; never rewritten for display. */
  itemName: z.string().min(1),
  quantity: z.number().int().positive(),
  /** Amount paid in INR. */
  totalPaid: z.number().nonnegative(),
  orderStatus: z.string().min(1),
});
export type OrderLine = z.infer<typeof OrderLineSchema>;

/** A month filter: `YYYY-MM`, or `all` for every month. */
export const MonthFilterSchema = z.union([
  z.literal('all'),
  z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'Expected YYYY-MM'),
]);
export type MonthFilter = z.infer<typeof MonthFilterSchema>;
