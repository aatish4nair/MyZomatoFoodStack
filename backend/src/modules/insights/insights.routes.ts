import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { InsightsSchema, MonthQuerySchema } from '@food-stack/shared';
import type { OrderRepository } from '../orders/order-repository.js';
import { computeInsights } from './compute-insights.js';

/** GET /api/insights?month=all|YYYY-MM: the four spending metrics (not shown in the UI). */
export const insightsRoutes: FastifyPluginAsyncZod<{ repository: OrderRepository }> = async (
  app,
  { repository },
) => {
  app.get(
    '/insights',
    { schema: { querystring: MonthQuerySchema, response: { 200: InsightsSchema } } },
    async (request) => {
      const snapshot = await repository.getSnapshot();
      return {
        ...computeInsights(snapshot.orders, request.query.month),
        freshness: { fetchedAt: snapshot.fetchedAt.toISOString(), stale: snapshot.stale },
      };
    },
  );
  return Promise.resolve();
};
