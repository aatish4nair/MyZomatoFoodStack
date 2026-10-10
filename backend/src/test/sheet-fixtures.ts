/** Synthetic sheet rows for tests. Every value is invented. */
export const HEADER = [
  'S. No.',
  'Order ID',
  'Order Date',
  'Order Time',
  'Restaurant',
  'Item Name',
  'Quantity',
  'Total Paid',
  'Order Status',
  'Gmail Message ID',
];

export const GMAIL_ID = 'gmail-msg-SECRET-123';

/** Sheets date serial for a calendar date (days since 1899-12-30). */
export const serial = (iso: string): number =>
  (Date.UTC(Number(iso.slice(0, 4)), Number(iso.slice(5, 7)) - 1, Number(iso.slice(8, 10))) -
    Date.UTC(1899, 11, 30)) /
  86_400_000;

export const row = (
  overrides: Partial<Record<(typeof HEADER)[number], unknown>> = {},
): unknown[] => {
  const base: Record<string, unknown> = {
    'S. No.': 1,
    'Order ID': 'Z1001',
    'Order Date': serial('2026-09-28'),
    'Order Time': 20.25 / 24,
    Restaurant: 'Imaginary Tandoor',
    'Item Name': 'Tandoori Chicken (breast Pcs)',
    Quantity: 1,
    'Total Paid': 366.04,
    'Order Status': 'Delivered',
    'Gmail Message ID': GMAIL_ID,
    ...overrides,
  };
  return HEADER.map((h) => base[h]);
};
