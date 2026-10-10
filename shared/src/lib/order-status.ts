import type { Order, StatusCategory } from '../contracts/order.js';

const UNSUCCESSFUL =
  /\b(cancel(l?ed)?|cancellation|refund(ed)?|fail(ed|ure)?|reject(ed)?|undelivered|not delivered|declined)\b/i;
const SUCCESSFUL = /\b(delivered|completed?|success(ful)?)\b/i;

/**
 * Status policy (documented in docs/architecture/DATA-MAPPING.md). Unsuccessful wording wins
 * over successful wording ("Delivery failed" is unsuccessful). Blank or unrecognised statuses
 * are `unknown`: they are excluded and reported instead of being guessed.
 */
export function categorizeStatus(status: string): StatusCategory {
  if (UNSUCCESSFUL.test(status)) return 'unsuccessful';
  if (SUCCESSFUL.test(status)) return 'successful';
  return 'unknown';
}

/** Whether an order counts towards search results and metrics. One rule, used everywhere. */
export const isCountedOrder = (order: Pick<Order, 'statusCategory'>): boolean =>
  order.statusCategory === 'successful';
