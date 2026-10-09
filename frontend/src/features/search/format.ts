const RUPEES = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** "₹366.04" */
export const formatRupees = (amount: number): string => RUPEES.format(amount);

const LONG_DATE = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  timeZone: 'UTC',
});

/** "2026-09-28" → "28 September 2026" */
export const formatLongDate = (isoDate: string): string =>
  LONG_DATE.format(new Date(`${isoDate}T00:00:00Z`));

const MONTH = new Intl.DateTimeFormat('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' });

/** "2026-09" → "September 2026" */
export const formatMonth = (yearMonth: string): string =>
  MONTH.format(new Date(`${yearMonth}-01T00:00:00Z`));

export const plural = (count: number, word: string): string =>
  `${String(count)} ${word}${count === 1 ? '' : 's'}`;
