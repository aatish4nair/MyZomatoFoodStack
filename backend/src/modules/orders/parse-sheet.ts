import {
  categorizeStatus,
  parseRupeesToPaise,
  type DataQuality,
  type Order,
  type OrderItem,
} from '@food-stack/shared';
import { DataUnavailableError } from '../../lib/data-errors.js';
import {
  cellText,
  parseQuantity,
  parseSheetDate,
  parseSheetTime,
  splitList,
} from './sheet-values.js';

/** Sheet columns the parser understands, located by header text (not position). */
const COLUMNS = {
  serialNumber: 'sno',
  orderId: 'orderid',
  orderDate: 'orderdate',
  orderTime: 'ordertime',
  restaurant: 'restaurant',
  itemName: 'itemname',
  quantity: 'quantity',
  totalPaid: 'totalpaid',
  orderStatus: 'orderstatus',
  gmailMessageId: 'gmailmessageid',
} as const;
type Column = keyof typeof COLUMNS;

/** Without these the sheet is not usable; the request fails with MALFORMED_SHEET. */
export const REQUIRED_COLUMNS: readonly Column[] = [
  'orderId',
  'orderDate',
  'restaurant',
  'itemName',
  'totalPaid',
  'orderStatus',
];

export type RejectionReason =
  | 'missing-order-id'
  | 'invalid-date'
  | 'missing-restaurant'
  | 'missing-item'
  | 'conflicting-order-details';

export interface ParseResult {
  orders: Order[];
  quality: DataQuality & { duplicateRows: number };
  /** Rejection counts by reason (no row contents), for logs and the sheet:check command. */
  rejections: Partial<Record<RejectionReason, number>>;
}

const normaliseHeader = (value: unknown): string =>
  cellText(value)
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');

/** Finds the header row (the first non-blank row) and maps each known column to its index. */
export function locateColumns(rows: readonly unknown[][]): {
  headerIndex: number;
  columns: Partial<Record<Column, number>>;
} {
  const headerIndex = rows.findIndex((row) => row.some((cell) => cellText(cell) !== ''));
  const header = rows[headerIndex] ?? [];
  const columns: Partial<Record<Column, number>> = {};
  header.forEach((cell, index) => {
    const name = normaliseHeader(cell);
    for (const [column, key] of Object.entries(COLUMNS) as [Column, string][]) {
      if (name === key && columns[column] === undefined) columns[column] = index;
    }
  });
  return { headerIndex, columns };
}

interface RowData {
  orderId: string;
  orderDate: string;
  orderTime: string | null;
  restaurant: string;
  items: OrderItem[];
  totalPaidPaise: number | null;
  status: string;
  /** Used only to recognise exact duplicate rows; never leaves this module. */
  fingerprint: string;
  rowCount: number;
}

/**
 * Turns the raw "Formatted Data" grid into validated orders. Policy (see DATA-MAPPING.md):
 * - Blank rows are skipped. Rows missing an order ID, a valid date, the restaurant or the item
 *   name are rejected and counted, never repaired.
 * - Rows sharing an order ID form one order. Their items are combined; exact duplicate rows
 *   (identical apart from S. No.) are counted once.
 * - Total Paid is treated as the whole order's total, repeated on each of its rows. If rows of one
 *   order carry different totals, the order's total becomes unknown (null) and is reported —
 *   totals are never summed or picked arbitrarily.
 * - Rows of one order that disagree on date or restaurant make the whole order invalid.
 * - An Item Name cell may list several items separated by ";". Each item may start with its
 *   quantity, written "N x " (the real sheet's format: "2 x Butter Naan; 1 x Dal Makhani"). That
 *   prefix becomes the item's quantity and is removed from the name; the rest of the name is kept
 *   exactly (brackets included). The per-item quantities are used when they add up to the Quantity
 *   cell (or the cell is blank); if they disagree, every quantity in the row is unknown (null).
 * - Without "N x " prefixes: a Quantity cell listing the same number of values pairs with the
 *   items; a single item takes the single quantity; otherwise the quantity is unknown (null).
 */
export function parseSheet(rows: readonly unknown[][]): ParseResult {
  const { headerIndex, columns } = locateColumns(rows);
  if (headerIndex < 0 || REQUIRED_COLUMNS.some((c) => columns[c] === undefined)) {
    throw new DataUnavailableError('MALFORMED_SHEET');
  }
  const get = (row: readonly unknown[], column: Column): unknown => {
    const index = columns[column];
    return index === undefined ? undefined : row[index];
  };

  const quality = {
    rowsRead: 0,
    blankRows: 0,
    rejectedRows: 0,
    ordersWithConflictingTotals: 0,
    ordersMissingTotal: 0,
    duplicateRows: 0,
  };
  const rejections: Partial<Record<RejectionReason, number>> = {};
  const reject = (reason: RejectionReason, count = 1): void => {
    quality.rejectedRows += count;
    rejections[reason] = (rejections[reason] ?? 0) + count;
  };

  const groups = new Map<string, RowData[]>();
  for (const row of rows.slice(headerIndex + 1)) {
    quality.rowsRead++;
    if (!row.some((cell) => cellText(cell) !== '')) {
      quality.blankRows++;
      continue;
    }
    const orderId = cellText(get(row, 'orderId'));
    const rawId = get(row, 'orderId');
    if (!orderId || (typeof rawId === 'number' && !Number.isSafeInteger(rawId))) {
      reject('missing-order-id');
      continue;
    }
    const orderDate = parseSheetDate(get(row, 'orderDate'));
    if (!orderDate) {
      reject('invalid-date');
      continue;
    }
    const restaurant = cellText(get(row, 'restaurant'));
    if (!restaurant) {
      reject('missing-restaurant');
      continue;
    }
    const names = splitList(cellText(get(row, 'itemName')));
    if (names.length === 0) {
      reject('missing-item');
      continue;
    }
    const items = pairQuantities(names, get(row, 'quantity'));
    const timeCell = get(row, 'orderTime');
    const row_: RowData = {
      orderId,
      orderDate,
      orderTime:
        timeCell === undefined || cellText(timeCell) === '' ? null : parseSheetTime(timeCell),
      restaurant,
      items,
      totalPaidPaise: parseRupeesToPaise(get(row, 'totalPaid')),
      status: cellText(get(row, 'orderStatus')),
      fingerprint: JSON.stringify(
        (Object.keys(COLUMNS) as Column[])
          .filter((c) => c !== 'serialNumber')
          .map((c) => cellText(get(row, c))),
      ),
      rowCount: 1,
    };
    const group = groups.get(orderId);
    if (!group) groups.set(orderId, [row_]);
    else if (group.some((existing) => existing.fingerprint === row_.fingerprint))
      quality.duplicateRows++;
    else group.push(row_);
  }

  const orders: Order[] = [];
  for (const [orderId, group] of groups) {
    const first = group[0];
    if (!first) continue;
    if (group.some((r) => r.orderDate !== first.orderDate || r.restaurant !== first.restaurant)) {
      reject('conflicting-order-details', group.length);
      continue;
    }
    const totals = new Set(
      group.map((r) => r.totalPaidPaise).filter((t): t is number => t !== null),
    );
    let totalPaidPaise: number | null = null;
    if (totals.size === 1) totalPaidPaise = [...totals][0] ?? null;
    else if (totals.size > 1) quality.ordersWithConflictingTotals++;
    if (totalPaidPaise === null) quality.ordersMissingTotal++;

    const statuses = new Set(group.map((r) => r.status));
    const status = statuses.size === 1 ? first.status : '';
    orders.push({
      orderId,
      orderDate: first.orderDate,
      orderTime: group.find((r) => r.orderTime !== null)?.orderTime ?? null,
      restaurant: first.restaurant,
      totalPaidPaise,
      status,
      statusCategory: categorizeStatus(status),
      items: group.flatMap((r) => r.items),
    });
  }
  return { orders, quality, rejections };
}

/** "2 x Butter Naan" → quantity 2, name "Butter Naan". Also "2x Naan" and "2 × Naan". */
const INLINE_QUANTITY = /^(\d{1,4})\s*[x×]\s+(\S.*)$/i;

function pairQuantities(names: string[], quantityCell: unknown): OrderItem[] {
  const inline = names.map((name) => {
    const match = INLINE_QUANTITY.exec(name);
    const quantity = match ? parseQuantity(match[1]) : null;
    return match?.[2] && quantity !== null ? { name: match[2].trim(), quantity } : null;
  });
  const items = inline.flatMap((item) => (item ? [item] : []));
  if (items.length === names.length) {
    const sum = items.reduce((total, item) => total + item.quantity, 0);
    const blank = cellText(quantityCell) === '';
    const agrees = blank || parseQuantity(quantityCell) === sum;
    return items.map((item) => ({ name: item.name, quantity: agrees ? item.quantity : null }));
  }

  const text = cellText(quantityCell);
  const quantities = splitList(text).map(parseQuantity);
  if (names.length === 1) {
    const only =
      typeof quantityCell === 'number'
        ? parseQuantity(quantityCell)
        : quantities.length === 1
          ? (quantities[0] ?? null)
          : null;
    return [{ name: names[0] ?? '', quantity: only }];
  }
  const paired = quantities.length === names.length;
  return names.map((name, i) => ({ name, quantity: paired ? (quantities[i] ?? null) : null }));
}
