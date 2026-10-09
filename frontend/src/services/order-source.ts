import { OrderLineSchema, type OrderLine } from '@food-stack/shared';
import { DEMO_ORDER_ROWS } from './demo-orders';

/**
 * Where the UI gets order lines from. Phase 1 uses synthetic demo data; Phase 2 replaces this
 * with a source that calls the backend API. Nothing else in the UI needs to change.
 */
export interface OrderSource {
  loadOrders(signal?: AbortSignal): Promise<OrderLine[]>;
}

/** Validates at the boundary, exactly as the API source will. */
export const demoOrderSource: OrderSource = {
  loadOrders: () => Promise.resolve(OrderLineSchema.array().parse(DEMO_ORDER_ROWS)),
};
