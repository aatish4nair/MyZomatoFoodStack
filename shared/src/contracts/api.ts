import { z } from 'zod';

export const HealthResponseSchema = z.object({
  status: z.literal('ok'),
});
export type HealthResponse = z.infer<typeof HealthResponseSchema>;

/** Every error the API returns has this shape; it never includes stack traces or input data. */
export const ApiErrorSchema = z.object({
  statusCode: z.number().int().min(400).max(599),
  error: z.string(),
  message: z.string(),
});
export type ApiError = z.infer<typeof ApiErrorSchema>;
