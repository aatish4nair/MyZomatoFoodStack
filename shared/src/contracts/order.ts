import { z } from 'zod';

/** A month filter: `YYYY-MM`, or `all` for every month. */
export const MonthFilterSchema = z.union([
  z.literal('all'),
  z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'Expected YYYY-MM'),
]);
export type MonthFilter = z.infer<typeof MonthFilterSchema>;

/**
 * How an order's status affects counts and spending:
 * - `successful`: counted (e.g. Delivered).
 * - `unsuccessful`: excluded (e.g. Cancelled, Refunded, Failed). Refund amounts are not in the
 *   source data, so none are invented.
 * - `unknown`: blank or unrecognised status, excluded and reported until the policy covers it.
 */
export const StatusCategorySchema = z.enum(['successful', 'unsuccessful', 'unknown']);
export type StatusCategory = z.infer<typeof StatusCategorySchema>;

export const OrderItemSchema = z.object({
  /** The item name exactly as recorded; never rewritten (display names are derived separately). */
  name: z.string().min(1),
  /** Quantity when the source states it unambiguously; otherwise null (never guessed). */
  quantity: z.number().int().positive().nullable(),
});
export type OrderItem = z.infer<typeof OrderItemSchema>;

/**
 * One Zomato order, as exposed by the backend API. Rows from the "Formatted Data" sheet that
 * share an Order ID are merged into one order. The sheet's row number ("S. No.") and the Gmail
 * Message ID are never part of this contract.
 */
export const OrderSchema = z.object({
  orderId: z.string().min(1),
  /** Calendar date of the order, `YYYY-MM-DD`. */
  orderDate: z.iso.date(),
  /** Local time of the order, `HH:mm`, or null when the sheet has none. */
  orderTime: z
    .string()
    .regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Expected HH:mm')
    .nullable(),
  restaurant: z.string().min(1),
  /**
   * Amount paid for the whole order, in paise (₹1 = 100 paise) so sums are exact integers.
   * Null when the sheet has no valid amount, or rows of the same order disagree.
   */
  totalPaidPaise: z.number().int().nonnegative().nullable(),
  status: z.string(),
  statusCategory: StatusCategorySchema,
  items: z.array(OrderItemSchema).min(1),
});
export type Order = z.infer<typeof OrderSchema>;

/**
 * An order as served by the public API: only the fields the website uses. Compared with `Order`
 * (the backend's internal record) it leaves out the Zomato order ID (replaced by an opaque ID),
 * the time of day and the raw status text.
 */
export const PublicOrderSchema = z.object({
  /**
   * Opaque ID ("o0001", "o0002", …), unique within one response and assigned oldest → newest, so
   * comparing two IDs orders same-day orders. It is not the Zomato order ID and can't be mapped
   * back to it.
   */
  orderId: z.string().regex(/^o\d{4,}$/, 'Expected an opaque order ID'),
  orderDate: z.iso.date(),
  restaurant: z.string().min(1),
  totalPaidPaise: z.number().int().nonnegative().nullable(),
  statusCategory: StatusCategorySchema,
  items: z.array(OrderItemSchema).min(1),
});
export type PublicOrder = z.infer<typeof PublicOrderSchema>;

/** What search and display code needs from an order (both `Order` and `PublicOrder` qualify). */
export type SearchableOrder = Pick<
  PublicOrder,
  'orderId' | 'orderDate' | 'restaurant' | 'totalPaidPaise' | 'statusCategory' | 'items'
>;
