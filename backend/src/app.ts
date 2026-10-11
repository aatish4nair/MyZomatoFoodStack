import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import Fastify, { type FastifyInstance } from 'fastify';
import {
  serializerCompiler,
  validatorCompiler,
  type ZodTypeProvider,
} from 'fastify-type-provider-zod';
import { allowedHostnames, sheetsConfig, type Env } from './config/env.js';
import {
  createSheetsReader,
  type SheetValuesReader,
} from './integrations/google-sheets/sheets-reader.js';
import { loggerOptions } from './lib/logger.js';
import { registerErrorHandling } from './middleware/error-handler.js';
import { registerLocalOnly } from './middleware/local-only.js';
import { healthRoutes } from './modules/health/health.routes.js';
import { insightsRoutes } from './modules/insights/insights.routes.js';
import { createOrderRepository } from './modules/orders/order-repository.js';
import { ordersRoutes } from './modules/orders/orders.routes.js';

export interface AppDeps {
  /** Replaces the Google Sheets reader (tests). `null` means "not configured". */
  sheetsReader?: SheetValuesReader | null;
  now?: () => number;
}

/** Builds the API without starting it, so tests can exercise it in-process. */
export async function buildApp(env: Env, deps: AppDeps = {}): Promise<FastifyInstance> {
  const app = Fastify({
    logger: loggerOptions(env),
    bodyLimit: 16 * 1024,
    // Trust X-Forwarded-For only for the configured number of proxy hops (0 locally), so the
    // client address used for rate limiting can't be spoofed by a visitor.
    // (Same as proxy-addr's numeric setting: trust the first N hops, counted from the server.)
    trustProxy:
      env.TRUST_PROXY_HOPS > 0
        ? (_address: string, hop: number) => hop < env.TRUST_PROXY_HOPS
        : false,
  }).withTypeProvider<ZodTypeProvider>();

  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);

  registerErrorHandling(app);
  registerLocalOnly(app, allowedHostnames(env));

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

  const config = sheetsConfig(env);
  const reader =
    deps.sheetsReader !== undefined
      ? deps.sheetsReader
      : config
        ? createSheetsReader(config)
        : null;
  const repository = createOrderRepository(reader, {
    ttlMs: config?.cacheTtlMs ?? env.SHEET_CACHE_TTL_SECONDS * 1000,
    maxRows: config?.maxRows ?? env.SHEET_MAX_ROWS,
    ...(deps.now ? { now: deps.now } : {}),
    onEvent: (event) => {
      if (event.type === 'refreshed') app.log.info({ rows: event.rows }, 'Order data refreshed');
      else app.log.warn({ code: event.code }, 'Order data refresh failed');
    },
  });

  await app.register(healthRoutes, { prefix: '/api' });
  await app.register(ordersRoutes, { prefix: '/api', repository });
  await app.register(insightsRoutes, { prefix: '/api', repository });

  return app;
}
