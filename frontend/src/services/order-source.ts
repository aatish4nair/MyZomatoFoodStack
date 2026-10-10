import {
  ApiErrorSchema,
  OrdersResponseSchema,
  type DataErrorCode,
  type Order,
} from '@food-stack/shared';

/**
 * Where the UI gets orders from. Components only ever see `Order[]`; they know nothing about
 * Google Sheets or the API.
 */
export interface OrderSource {
  loadOrders(signal?: AbortSignal): Promise<Order[]>;
}

/** Orders could not be loaded. `code` is the backend's safe reason, when it gave one. */
export class OrdersUnavailableError extends Error {
  override readonly name = 'OrdersUnavailableError';
  constructor(readonly code: DataErrorCode | 'NETWORK' | 'INVALID_RESPONSE') {
    super(code);
  }
}

/** Real data: GET /api/orders on our own origin (Vite forwards it to the backend locally). */
export const apiOrderSource: OrderSource = {
  async loadOrders(signal) {
    let response: Response;
    try {
      response = await fetch('/api/orders?month=all', {
        signal: signal ?? null,
        headers: { Accept: 'application/json' },
        credentials: 'same-origin',
      });
    } catch {
      throw new OrdersUnavailableError('NETWORK');
    }
    const body: unknown = await response.json().catch(() => null);
    if (!response.ok) {
      const error = ApiErrorSchema.safeParse(body);
      throw new OrdersUnavailableError(
        error.success && error.data.code ? error.data.code : 'NETWORK',
      );
    }
    const parsed = OrdersResponseSchema.safeParse(body);
    if (!parsed.success) throw new OrdersUnavailableError('INVALID_RESPONSE');
    return parsed.data.orders;
  },
};

/**
 * The source the app uses. Real data unless the app was started in demo mode
 * (`npm run dev:demo`). The demo data lives in a separate module that is only loaded in demo
 * mode, so production builds never contain it, and there is no automatic fallback to it.
 */
export function defaultOrderSource(): OrderSource {
  if (import.meta.env.MODE === 'demo') {
    return {
      loadOrders: async () => (await import('./demo-order-source')).demoOrderSource.loadOrders(),
    };
  }
  return apiOrderSource;
}
