import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { inMonth, MonthQuerySchema, OrdersResponseSchema } from '@food-stack/shared';
import type { OrderRepository } from './order-repository.js';

/** GET /api/orders?month=all|YYYY-MM: validated orders (no S. No. or Gmail Message IDs). */
export const ordersRoutes: FastifyPluginAsyncZod<{ repository: OrderRepository }> = async (
  app,
  { repository },
) => {
  app.get(
    '/orders',
    { schema: { querystring: MonthQuerySchema, response: { 200: OrdersResponseSchema } } },
    async (request) => {
      const { month } = request.query;
      const snapshot = await repository.getSnapshot();
      return {
        month,
        orders: snapshot.orders.filter((o) => inMonth(o, month)),
        // The response schema keeps only the public quality counts (internal ones are dropped).
        quality: snapshot.quality,
        freshness: { fetchedAt: snapshot.fetchedAt.toISOString(), stale: snapshot.stale },
      };
    },
  );
  return Promise.resolve();
};
