import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { HealthResponseSchema } from '@food-stack/shared';

export const healthRoutes: FastifyPluginAsyncZod = async (app) => {
  app.get('/health', { schema: { response: { 200: HealthResponseSchema } } }, () => ({
    status: 'ok' as const,
  }));
  return Promise.resolve();
};
