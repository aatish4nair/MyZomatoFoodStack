import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import {
  inMonth,
  MonthQuerySchema,
  OrdersResponseSchema,
  toPublicOrders,
} from '@food-stack/shared';
import type { OrderRepository } from './order-repository.js';

/**
 * GET /api/orders?month=all|YYYY-MM: the PUBLIC order list. Only the fields the website needs
 * (see toPublicOrders); no Zomato order IDs, times, raw statuses, row numbers or Gmail Message IDs.
 */
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
        orders: toPublicOrders(snapshot.orders).filter((o) => inMonth(o, month)),
        freshness: { fetchedAt: snapshot.fetchedAt.toISOString(), stale: snapshot.stale },
      };
    },
  );
  return Promise.resolve();
};
