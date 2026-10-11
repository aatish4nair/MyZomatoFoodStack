import { OrderSchema, PublicOrderSchema, toPublicOrders } from '@food-stack/shared';
import { DEMO_ORDERS } from './demo-orders';
import type { OrderSource } from './order-source';

/** Synthetic orders for demo mode and tests, in the public API shape. Validated like the API. */
export const demoOrderSource: OrderSource = {
  loadOrders: () =>
    Promise.resolve(
      PublicOrderSchema.array().parse(toPublicOrders(OrderSchema.array().parse(DEMO_ORDERS))),
    ),
};
