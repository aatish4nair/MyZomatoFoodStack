import { useEffect, useState } from 'react';
import type { OrderLine } from '@food-stack/shared';
import type { OrderSource } from '../services/order-source';

export type OrdersState =
  | { status: 'loading'; orders: readonly OrderLine[] }
  | { status: 'ready'; orders: readonly OrderLine[] }
  | { status: 'unavailable'; orders: readonly OrderLine[] };

const EMPTY: readonly OrderLine[] = [];

/** Loads orders once. A failure degrades to an empty dataset; the page still works. */
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
