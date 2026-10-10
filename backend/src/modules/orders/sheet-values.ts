/**
 * Parsers for individual sheet cells. Values arrive unformatted from the Sheets API: real dates
 * and times are serial numbers (days since 1899-12-30), numbers are numbers, text is text.
 * Each parser returns null rather than guessing.
 */

const MS_PER_DAY = 86_400_000;
const SHEETS_EPOCH_MS = Date.UTC(1899, 11, 30);
const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

const pad = (n: number): string => String(n).padStart(2, '0');

function isoDate(year: number, month: number, day: number): string | null {
  if (year < 2000 || year > 2100 || month < 1 || month > 12 || day < 1) return null;
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null; // e.g. 31/02
  return `${String(year)}-${pad(month)}-${pad(day)}`;
}

/**
 * Accepts: a Sheets date serial; `YYYY-MM-DD`; day-first `DD/MM/YYYY`, `DD-MM-YYYY`, `DD.MM.YYYY`
 * (the Indian convention; month-first is never assumed); `DD Mon YYYY`; `Mon DD, YYYY`.
 * Any trailing time part is ignored.
 */
export function parseSheetDate(value: unknown): string | null {
  if (typeof value === 'number') {
    if (!Number.isFinite(value) || value < 1) return null;
    const date = new Date(SHEETS_EPOCH_MS + Math.floor(value) * MS_PER_DAY);
    return isoDate(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate());
  }
  if (typeof value !== 'string') return null;
  const text = value.trim();
  let m = /^(\d{4})-(\d{1,2})-(\d{1,2})(?:[T\s].*)?$/.exec(text);
  if (m) return isoDate(Number(m[1]), Number(m[2]), Number(m[3]));
  m = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})(?:[\s,].*)?$/.exec(text);
  if (m) return isoDate(Number(m[3]), Number(m[2]), Number(m[1]));
  m = /^(\d{1,2})[\s-]([A-Za-z]{3,9})[\s-,]+(\d{4})(?:[\s,].*)?$/.exec(text);
  if (m) return isoDate(Number(m[3]), monthIndex(m[2]), Number(m[1]));
  m = /^([A-Za-z]{3,9})\s+(\d{1,2}),?\s+(\d{4})(?:[\s,].*)?$/.exec(text);
  if (m) return isoDate(Number(m[3]), monthIndex(m[1]), Number(m[2]));
  return null;
}

const monthIndex = (name: string | undefined): number =>
  MONTHS.indexOf((name ?? '').slice(0, 3).toLowerCase()) + 1;

/** Accepts a Sheets time (fraction of a day, or date+time serial), `HH:mm[:ss]`, or `h:mm[:ss] AM/PM`. */
export function parseSheetTime(value: unknown): string | null {
  if (typeof value === 'number') {
    if (!Number.isFinite(value) || value < 0) return null;
    const minutes = Math.round((value - Math.floor(value)) * 24 * 60) % (24 * 60);
    return `${pad(Math.floor(minutes / 60))}:${pad(minutes % 60)}`;
  }
  if (typeof value !== 'string') return null;
  const m = /^(\d{1,2}):(\d{2})(?::\d{2})?\s*([AaPp]\.?[Mm]\.?)?$/.exec(value.trim());
  if (!m) return null;
  let hours = Number(m[1]);
  const minutes = Number(m[2]);
  const meridiem = m[3]?.toLowerCase().replace(/\./g, '');
  if (minutes > 59) return null;
  if (meridiem) {
    if (hours < 1 || hours > 12) return null;
    hours = (hours % 12) + (meridiem === 'pm' ? 12 : 0);
  } else if (hours > 23) {
    return null;
  }
  return `${pad(hours)}:${pad(minutes)}`;
}

/** Positive whole quantities only ("2", 2, "2.0"); anything else is unknown. */
export function parseQuantity(value: unknown): number | null {
  const n =
    typeof value === 'number' ? value : typeof value === 'string' ? Number(value.trim()) : NaN;
  return Number.isInteger(n) && n > 0 && n < 10_000 ? n : null;
}

/** Text content of a cell (numbers converted without scientific notation), trimmed. */
export function cellText(value: unknown): string {
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number' && Number.isFinite(value)) {
    return Number.isInteger(value) ? value.toFixed(0) : String(value);
  }
  if (typeof value === 'boolean') return String(value);
  return '';
}

/** Splits a cell that may list several items separated by semicolons. */
export const splitList = (text: string): string[] =>
  text
    .split(';')
    .map((part) => part.trim())
    .filter(Boolean);
