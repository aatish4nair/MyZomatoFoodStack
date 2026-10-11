import { useEffect, useState } from 'react';
import type { PublicOrder as Order } from '@food-stack/shared';
import type { OrderSource } from '../services/order-source';

export type OrdersState =
  | { status: 'loading'; orders: readonly Order[] }
  | { status: 'ready'; orders: readonly Order[] }
  | { status: 'unavailable'; orders: readonly Order[] };

const EMPTY: readonly Order[] = [];

/**
 * Loads orders once. On failure the state is `unavailable` with no orders: the page shows a quiet
 * error message and never substitutes demo data.
 */
export function useOrders(source: OrderSource): OrdersState {
  const [state, setState] = useState<OrdersState>({ status: 'loading', orders: EMPTY });

  useEffect(() => {
    const controller = new AbortController();
    source.loadOrders(controller.signal).then(
      (orders) => {
        if (!controller.signal.aborted) setState({ status: 'ready', orders });
      },
      () => {
        if (!controller.signal.aborted) setState({ status: 'unavailable', orders: EMPTY });
      },
    );
    return () => {
      controller.abort();
    };
  }, [source]);

  return state;
}
