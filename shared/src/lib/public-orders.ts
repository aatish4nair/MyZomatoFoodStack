import type { Order, PublicOrder } from '../contracts/order.js';

/**
 * Turns internal orders into the public API shape: only the fields the website needs.
 * - The Zomato order ID is replaced by an opaque ID ("o0001", …) assigned oldest → newest (by
 *   date, then time, then the original ID), so same-day orders still sort correctly without
 *   exposing the time of day. The opaque IDs can't be mapped back to Zomato order IDs.
 * - The time of day and the raw status text are left out (statusCategory is enough to count).
 * IDs are assigned over ALL orders before any month filter, so one order keeps one ID per snapshot.
 */
export function toPublicOrders(orders: readonly Order[]): PublicOrder[] {
  const chronological = [...orders].sort(
    (a, b) =>
      a.orderDate.localeCompare(b.orderDate) ||
      (a.orderTime ?? '').localeCompare(b.orderTime ?? '') ||
      a.orderId.localeCompare(b.orderId, 'en', { numeric: true }),
  );
  const width = Math.max(4, String(chronological.length).length);
  return chronological.map((order, index) => ({
    orderId: `o${String(index + 1).padStart(width, '0')}`,
    orderDate: order.orderDate,
    restaurant: order.restaurant,
    totalPaidPaise: order.totalPaidPaise,
    statusCategory: order.statusCategory,
    items: order.items.map((item) => ({ name: item.name, quantity: item.quantity })),
  }));
}
