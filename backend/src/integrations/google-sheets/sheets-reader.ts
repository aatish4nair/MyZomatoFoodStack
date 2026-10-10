import { GoogleAuth } from 'google-auth-library';
import { z } from 'zod';
import type { SheetsConfig } from '../../config/env.js';
import { DataUnavailableError } from '../../lib/data-errors.js';

/** The ONLY scope requested: read-only access to spreadsheets shared with the service account. */
export const SHEETS_READONLY_SCOPE = 'https://www.googleapis.com/auth/spreadsheets.readonly';

/** Everything the rest of the backend knows about Google Sheets: a grid of cell values. */
export interface SheetValuesReader {
  readValues(): Promise<unknown[][]>;
}

export interface ReaderDeps {
  getAccessToken?: () => Promise<string | null | undefined>;
  fetch?: typeof globalThis.fetch;
}

const ValuesResponse = z.object({ values: z.array(z.array(z.unknown())).optional() });

/**
 * Reads the configured range with the Sheets API `values.get` method, using a service account.
 * Cells come back unformatted, so real dates arrive as serial numbers and numeric amounts as
 * numbers. Every failure becomes a DataUnavailableError with a safe code.
 */
export function createSheetsReader(config: SheetsConfig, deps: ReaderDeps = {}): SheetValuesReader {
  const doFetch = deps.fetch ?? globalThis.fetch;
  const getAccessToken = deps.getAccessToken ?? defaultTokenSource(config);
  const url =
    `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(config.spreadsheetId)}` +
    `/values/${encodeURIComponent(config.range)}` +
    '?majorDimension=ROWS&valueRenderOption=UNFORMATTED_VALUE&dateTimeRenderOption=SERIAL_NUMBER';

  return {
    async readValues() {
      const token = await withTimeout(getAccessToken(), config.timeoutMs).catch(
        (error: unknown) => {
          throw error instanceof DataUnavailableError
            ? error
            : new DataUnavailableError('UPSTREAM_AUTH');
        },
      );
      if (!token) throw new DataUnavailableError('UPSTREAM_AUTH');

      let response: Response;
      try {
        response = await doFetch(url, {
          headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
          signal: AbortSignal.timeout(config.timeoutMs),
        });
      } catch (error) {
        throw new DataUnavailableError(isTimeout(error) ? 'UPSTREAM_TIMEOUT' : 'UPSTREAM_ERROR');
      }

      if (!response.ok) throw new DataUnavailableError(codeForStatus(response.status));

      let body: unknown;
      try {
        body = await response.json();
      } catch {
        throw new DataUnavailableError('MALFORMED_SHEET');
      }
      const parsed = ValuesResponse.safeParse(body);
      if (!parsed.success) throw new DataUnavailableError('MALFORMED_SHEET');
      return parsed.data.values ?? [];
    },
  };
}

function defaultTokenSource(config: SheetsConfig): () => Promise<string | null | undefined> {
  const auth =
    config.credentials.kind === 'key-file'
      ? new GoogleAuth({ keyFile: config.credentials.path, scopes: [SHEETS_READONLY_SCOPE] })
      : new GoogleAuth({
          credentials: JSON.parse(config.credentials.json) as Record<string, string>,
          scopes: [SHEETS_READONLY_SCOPE],
        });
  return () => auth.getAccessToken();
}

export function codeForStatus(status: number): DataUnavailableError['code'] {
  if (status === 401 || status === 403) return 'UPSTREAM_AUTH';
  if (status === 404 || status === 400) return 'UPSTREAM_NOT_FOUND'; // 400: e.g. unknown tab name
  if (status === 429) return 'UPSTREAM_QUOTA';
  return 'UPSTREAM_ERROR';
}

const isTimeout = (error: unknown): boolean =>
  error instanceof Error && (error.name === 'TimeoutError' || error.name === 'AbortError');

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new DataUnavailableError('UPSTREAM_TIMEOUT'));
    }, ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error: unknown) => {
        clearTimeout(timer);
        reject(error instanceof Error ? error : new Error('Token request failed'));
      },
    );
  });
}
