import { OrderSchema } from '@food-stack/shared';
import { DEMO_ORDERS } from './demo-orders';
import type { OrderSource } from './order-source';

/** Synthetic orders for demo mode and tests. Validated at the boundary, like the API. */
export const demoOrderSource: OrderSource = {
  loadOrders: () => Promise.resolve(OrderSchema.array().parse(DEMO_ORDERS)),
};
