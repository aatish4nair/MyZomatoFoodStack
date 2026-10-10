import type { FastifyError, FastifyInstance } from 'fastify';
import { hasZodFastifySchemaValidationErrors } from 'fastify-type-provider-zod';
import type { ApiError } from '@food-stack/shared';
import { DATA_ERROR_MESSAGES, DataUnavailableError } from '../lib/data-errors.js';

/**
 * Uniform, safe error responses: no stack traces, no echo of request input,
 * and a generic message for anything that is the server's fault.
 */
export function registerErrorHandling(app: FastifyInstance): void {
  app.setErrorHandler<FastifyError>((error, request, reply) => {
    if (error instanceof DataUnavailableError) {
      // Only the safe code is logged; Google's own error details are never kept or forwarded.
      request.log.warn({ code: error.code }, 'Order data unavailable');
      const body: ApiError = {
        statusCode: 503,
        error: 'Service Unavailable',
        message: DATA_ERROR_MESSAGES[error.code],
        code: error.code,
      };
      return reply.status(503).send(body);
    }

    if (hasZodFastifySchemaValidationErrors(error)) {
      const body: ApiError = {
        statusCode: 400,
        error: 'Bad Request',
        message: 'Request validation failed',
      };
      return reply.status(400).send(body);
    }

    const statusCode =
      typeof error.statusCode === 'number' && error.statusCode >= 400 ? error.statusCode : 500;

    if (statusCode >= 500) {
      request.log.error({ err: { name: error.name, code: error.code } }, 'Unhandled error');
      const body: ApiError = {
        statusCode,
        error: 'Internal Server Error',
        message: 'Something went wrong',
      };
      return reply.status(statusCode).send(body);
    }

    const body: ApiError = {
      statusCode,
      error: statusCode === 429 ? 'Too Many Requests' : 'Request Error',
      message: error.message,
    };
    return reply.status(statusCode).send(body);
  });

  app.setNotFoundHandler((_request, reply) => {
    const body: ApiError = { statusCode: 404, error: 'Not Found', message: 'Route not found' };
    return reply.status(404).send(body);
  });
}
