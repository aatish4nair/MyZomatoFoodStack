import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import Fastify, { type FastifyInstance } from 'fastify';
import {
  serializerCompiler,
  validatorCompiler,
  type ZodTypeProvider,
} from 'fastify-type-provider-zod';
import type { Env } from './config/env.js';
import { loggerOptions } from './lib/logger.js';
import { registerErrorHandling } from './middleware/error-handler.js';
import { healthRoutes } from './modules/health/health.routes.js';

/** Builds the API without starting it, so tests can exercise it in-process. */
export async function buildApp(env: Env): Promise<FastifyInstance> {
  const app = Fastify({
    logger: loggerOptions(env),
    bodyLimit: 16 * 1024,
    // Only trust X-Forwarded-* headers once a known reverse proxy is in front (deployment phase).
    trustProxy: false,
  }).withTypeProvider<ZodTypeProvider>();

  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);

  registerErrorHandling(app);

  // The API only serves JSON, so its CSP denies everything.
  await app.register(helmet, {
    contentSecurityPolicy: {
      useDefaults: false,
      directives: {
        defaultSrc: ["'none'"],
        frameAncestors: ["'none'"],
        baseUri: ["'none'"],
        formAction: ["'none'"],
      },
    },
    crossOriginResourcePolicy: { policy: 'same-origin' },
  });

  await app.register(cors, {
    origin: env.CORS_ORIGINS,
    methods: ['GET'],
    credentials: false,
  });

  await app.register(rateLimit, {
    max: env.RATE_LIMIT_MAX,
    timeWindow: env.RATE_LIMIT_WINDOW_MS,
  });

  await app.register(healthRoutes, { prefix: '/api' });

  return app;
}
