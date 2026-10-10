/**
 * `npm run sheet:check`: verifies the Google Sheets connection and prints the STRUCTURE of the
 * "Formatted Data" tab, so the parsing rules can be confirmed against the real sheet.
 *
 * It never prints order IDs, item names, restaurants, amounts, dates or Gmail IDs. Formats are
 * shown as masked "shapes" (digits → 9, letters → a), e.g. a date like 28/09/2026 → "99/99/9999".
 * Status values are printed because they are labels such as "Delivered", not personal data.
 */
import { categorizeStatus } from '@food-stack/shared';
import { loadEnv, sheetsConfig } from '../config/env.js';
import { createSheetsReader } from '../integrations/google-sheets/sheets-reader.js';
import { DATA_ERROR_MESSAGES, DataUnavailableError } from '../lib/data-errors.js';
import { locateColumns, parseSheet, REQUIRED_COLUMNS } from '../modules/orders/parse-sheet.js';
import { cellText, parseRupeesToPaiseSafe } from './check-helpers.js';

const shape = (value: unknown): string =>
  typeof value === 'number'
    ? Number.isInteger(value)
      ? 'number (whole)'
      : 'number (decimal)'
    : cellText(value)
        .replace(/\p{L}/gu, 'a')
        .replace(/\d/g, '9')
        .replace(/a{2,}/g, 'aa…')
        .replace(/9{5,}/g, '99999…') || '(blank)';

function topShapes(values: unknown[], limit = 4): string {
  const counts = new Map<string, number>();
  for (const v of values) counts.set(shape(v), (counts.get(shape(v)) ?? 0) + 1);
  return [...counts]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([s, n]) => `${s} ×${String(n)}`)
    .join(', ');
}

async function main(): Promise<void> {
  const config = sheetsConfig(loadEnv());
  if (!config) {
    console.log(
      'Not configured: set GOOGLE_SHEET_ID and a service-account credential in backend/.env.',
    );
    process.exitCode = 1;
    return;
  }

  const rows = await createSheetsReader(config).readValues();
  console.log(
    `✓ Connected. Read ${String(rows.length)} rows (including the header) from ${config.range}.\n`,
  );

  const { headerIndex, columns } = locateColumns(rows);
  const header = (rows[headerIndex] ?? []).map((h) => cellText(h));
  console.log('Headers found:', header.join(' | '));
  const missing = REQUIRED_COLUMNS.filter((c) => columns[c] === undefined);
  console.log(
    missing.length
      ? `✗ Missing required columns: ${missing.join(', ')}`
      : '✓ All required columns present.',
  );
  if (missing.length) {
    process.exitCode = 1;
    return;
  }

  const body = rows.slice(headerIndex + 1).filter((r) => r.some((c) => cellText(c) !== ''));
  const col = (name: keyof typeof columns): unknown[] => {
    const index = columns[name];
    return index === undefined ? [] : body.map((r) => r[index]);
  };

  console.log('\nValue formats (masked):');
  for (const name of ['orderDate', 'orderTime', 'quantity', 'totalPaid', 'orderId'] as const) {
    if (columns[name] !== undefined) console.log(`  ${name.padEnd(11)} ${topShapes(col(name))}`);
  }

  const items = col('itemName').map(cellText);
  console.log('\nItem Name cells:');
  console.log(
    `  containing ";" (several items in one cell): ${String(items.filter((t) => t.includes(';')).length)}`,
  );
  console.log(`  containing brackets: ${String(items.filter((t) => /[([{]/.test(t)).length)}`);

  const byOrder = new Map<string, unknown[][]>();
  const idIndex = columns.orderId ?? 0;
  for (const r of body) {
    const id = cellText(r[idIndex]);
    if (id) byOrder.set(id, [...(byOrder.get(id) ?? []), r]);
  }
  const multi = [...byOrder.values()].filter((g) => g.length > 1);
  const totalIndex = columns.totalPaid ?? 0;
  const sameTotal = multi.filter(
    (g) => new Set(g.map((r) => parseRupeesToPaiseSafe(r[totalIndex]))).size === 1,
  );
  console.log('\nOrders:');
  console.log(`  distinct order IDs: ${String(byOrder.size)}`);
  console.log(`  orders spread over several rows: ${String(multi.length)}`);
  console.log(`    …where every row repeats the same Total Paid: ${String(sameTotal.length)}`);
  console.log(
    `    …where rows have different Total Paid values: ${String(multi.length - sameTotal.length)}`,
  );
  if (multi.length && sameTotal.length < multi.length / 2) {
    console.log(
      '  ⚠ Total Paid looks per-item rather than per-order. Tell Claude: the spending rule needs changing.',
    );
  }

  const statusCounts = new Map<string, number>();
  for (const s of col('orderStatus').map(cellText))
    statusCounts.set(s, (statusCounts.get(s) ?? 0) + 1);
  console.log('\nOrder Status values (row counts → how the app treats them):');
  for (const [status, n] of [...statusCounts].sort((a, b) => b[1] - a[1])) {
    console.log(
      `  ${(status || '(blank)').padEnd(28)} ×${String(n).padEnd(6)} → ${categorizeStatus(status)}`,
    );
  }

  const { orders, quality, rejections } = parseSheet(rows);
  console.log('\nParsing result:');
  console.log(`  valid orders: ${String(orders.length)}`);
  console.log(`  ${JSON.stringify(quality)}`);
  console.log(`  rejected rows by reason: ${JSON.stringify(rejections)}`);
  console.log(
    `  orders with unknown quantity on some item: ${String(orders.filter((o) => o.items.some((i) => i.quantity === null)).length)}`,
  );
}

main().catch((error: unknown) => {
  const code = error instanceof DataUnavailableError ? error.code : 'UPSTREAM_ERROR';
  console.error(`✗ ${code}: ${DATA_ERROR_MESSAGES[code]}`);
  console.error('  See docs/development/GOOGLE-SHEETS-SETUP.md → Troubleshooting.');
  process.exitCode = 1;
});
