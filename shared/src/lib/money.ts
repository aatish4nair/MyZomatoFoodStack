/**
 * Parses an amount in rupees into whole paise, exactly. Accepts plain numbers (as returned for
 * numeric sheet cells) and text such as "₹1,234.50", "Rs. 366.04" or "INR 99".
 * Returns null for anything else (blank, negative, more than two decimals, words): amounts are
 * never guessed.
 */
export function parseRupeesToPaise(value: unknown): number | null {
  if (typeof value === 'number') {
    if (!Number.isFinite(value) || value < 0) return null;
    const paise = Math.round(value * 100);
    // Reject values with more than two decimal places instead of silently rounding them.
    return Math.abs(paise - value * 100) < 1e-6 ? paise : null;
  }
  if (typeof value !== 'string') return null;
  const cleaned = value
    .trim()
    .replace(/^(₹|rs\.?|inr)\s*/i, '')
    .replace(/,/g, '');
  const match = /^(\d+)(?:\.(\d{1,2}))?$/.exec(cleaned);
  if (!match) return null;
  const rupees = Number(match[1]);
  const fraction = (match[2] ?? '').padEnd(2, '0');
  const paise = rupees * 100 + Number(fraction);
  return Number.isSafeInteger(paise) ? paise : null;
}

/** Paise → rupees, for display only. */
export const paiseToRupees = (paise: number): number => paise / 100;

/**
 * DISPLAY ONLY: whole rupees, rounded half up (₹1,985.49 → ₹1,985; ₹1,985.50 → ₹1,986).
 * Integer arithmetic, so there's no floating-point error. Apply it to a final total, never to
 * values that are then added or averaged; calculations stay in exact paise.
 */
export function roundPaiseToRupees(paise: number): number {
  const sign = paise < 0 ? -1 : 1;
  return sign * Math.floor((Math.abs(paise) + 50) / 100);
}
