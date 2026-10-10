import { parseRupeesToPaise } from '@food-stack/shared';

export { cellText } from '../modules/orders/sheet-values.js';

/** Amount as paise, or a marker for blank/invalid, used only to compare rows of one order. */
export const parseRupeesToPaiseSafe = (value: unknown): number | 'invalid' =>
  parseRupeesToPaise(value) ?? 'invalid';
