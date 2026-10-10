import type { Order } from '@food-stack/shared';
import type { SheetValuesReader } from '../../integrations/google-sheets/sheets-reader.js';
import { DataUnavailableError } from '../../lib/data-errors.js';
import { parseSheet, type ParseResult } from './parse-sheet.js';

export interface OrderSnapshot {
  orders: readonly Order[];
  quality: ParseResult['quality'];
  rejections: ParseResult['rejections'];
  fetchedAt: Date;
  stale: boolean;
}

export interface OrderRepository {
  getSnapshot(): Promise<OrderSnapshot>;
}

export interface RepositoryOptions {
  /** How long a successful read is reused before the sheet is read again. */
  ttlMs: number;
  /** After a failed read, wait this long before trying Google again (no hammering). */
  retryAfterFailureMs?: number;
  maxRows: number;
  now?: () => number;
  /** Receives only safe facts (a code or counts), never data. */
  onEvent?: (event: { type: 'refreshed'; rows: number } | { type: 'failed'; code: string }) => void;
}

/**
 * Bounded in-memory cache in front of the sheet: one snapshot, refreshed at most once per TTL.
 * Concurrent requests share a single in-flight read. If a refresh fails, the last good snapshot
 * is served marked `stale`; with no snapshot yet, the error is returned (and the same error is
 * reused until the retry delay has passed). Spreadsheet edits appear within one TTL, without a
 * restart.
 */
export function createOrderRepository(
  reader: SheetValuesReader | null,
  options: RepositoryOptions,
): OrderRepository {
  const now = options.now ?? Date.now;
  const retryAfterFailureMs = options.retryAfterFailureMs ?? 5_000;
  let snapshot: OrderSnapshot | null = null;
  let inFlight: Promise<OrderSnapshot> | null = null;
  let lastFailure: { at: number; error: DataUnavailableError } | null = null;

  const refresh = async (): Promise<OrderSnapshot> => {
    if (!reader) throw new DataUnavailableError('NOT_CONFIGURED');
    try {
      const rows = await reader.readValues();
      if (rows.length > options.maxRows + 1) throw new DataUnavailableError('MALFORMED_SHEET');
      const parsed = parseSheet(rows);
      snapshot = { ...parsed, fetchedAt: new Date(now()), stale: false };
      lastFailure = null;
      options.onEvent?.({ type: 'refreshed', rows: parsed.quality.rowsRead });
      return snapshot;
    } catch (error) {
      const safe =
        error instanceof DataUnavailableError ? error : new DataUnavailableError('UPSTREAM_ERROR');
      lastFailure = { at: now(), error: safe };
      options.onEvent?.({ type: 'failed', code: safe.code });
      if (snapshot) return { ...snapshot, stale: true };
      throw safe;
    }
  };

  return {
    async getSnapshot() {
      if (!reader) throw new DataUnavailableError('NOT_CONFIGURED');
      const current = now();
      if (snapshot && !lastFailure && current - snapshot.fetchedAt.getTime() < options.ttlMs)
        return snapshot;
      if (lastFailure && current - lastFailure.at < retryAfterFailureMs) {
        if (snapshot) return { ...snapshot, stale: true };
        throw lastFailure.error;
      }
      inFlight ??= refresh().finally(() => {
        inFlight = null;
      });
      return inFlight;
    },
  };
}
