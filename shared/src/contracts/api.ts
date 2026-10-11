import { z } from 'zod';
import { MonthFilterSchema, PublicOrderSchema } from './order.js';

export const HealthResponseSchema = z.object({
  status: z.literal('ok'),
});
export type HealthResponse = z.infer<typeof HealthResponseSchema>;

/**
 * Safe, non-sensitive reasons the order data could not be served. They help troubleshooting
 * without exposing Google's raw error messages.
 */
export const DataErrorCodeSchema = z.enum([
  'NOT_CONFIGURED',
  'UPSTREAM_AUTH',
  'UPSTREAM_NOT_FOUND',
  'UPSTREAM_QUOTA',
  'UPSTREAM_TIMEOUT',
  'UPSTREAM_ERROR',
  'MALFORMED_SHEET',
]);
export type DataErrorCode = z.infer<typeof DataErrorCodeSchema>;

/** Every error the API returns has this shape; it never includes stack traces or input data. */
export const ApiErrorSchema = z.object({
  statusCode: z.number().int().min(400).max(599),
  error: z.string(),
  message: z.string(),
  code: DataErrorCodeSchema.optional(),
});
export type ApiError = z.infer<typeof ApiErrorSchema>;

export const MonthQuerySchema = z.object({
  month: MonthFilterSchema.default('all'),
});

/** Data-quality counts. They describe rows, never their contents. Internal: logs and sheet:check. */
export const DataQualitySchema = z.object({
  rowsRead: z.number().int().nonnegative(),
  blankRows: z.number().int().nonnegative(),
  rejectedRows: z.number().int().nonnegative(),
  ordersWithConflictingTotals: z.number().int().nonnegative(),
  ordersMissingTotal: z.number().int().nonnegative(),
});
export type DataQuality = z.infer<typeof DataQualitySchema>;

export const DataFreshnessSchema = z.object({
  /** When the sheet was last read successfully (ISO timestamp). */
  fetchedAt: z.iso.datetime(),
  /** True when the latest read failed and the previous good copy is being served. */
  stale: z.boolean(),
});

/**
 * GET /api/orders. Public: everything here is visible to anyone who can reach the API. Only the
 * fields the website needs; the response schema strips anything else before it is sent.
 */
export const OrdersResponseSchema = z.object({
  month: MonthFilterSchema,
  orders: z.array(PublicOrderSchema),
  freshness: DataFreshnessSchema,
});
export type OrdersResponse = z.infer<typeof OrdersResponseSchema>;
