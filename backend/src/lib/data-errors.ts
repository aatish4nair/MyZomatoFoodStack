import type { DataErrorCode } from '@food-stack/shared';

/**
 * The order data could not be served. Carries only a safe code: the original error (which may
 * contain Google's messages, URLs or identifiers) is never forwarded to the browser or logged.
 */
export class DataUnavailableError extends Error {
  override readonly name = 'DataUnavailableError';
  constructor(readonly code: DataErrorCode) {
    super(code);
  }
}

/** Plain-language messages that are safe to show in the browser. */
export const DATA_ERROR_MESSAGES: Record<DataErrorCode, string> = {
  NOT_CONFIGURED: 'Order data is not configured on the server.',
  UPSTREAM_AUTH: 'The server could not access the spreadsheet (check credentials and sharing).',
  UPSTREAM_NOT_FOUND: 'The configured spreadsheet or tab was not found.',
  UPSTREAM_QUOTA: 'Google Sheets is limiting requests. Please try again shortly.',
  UPSTREAM_TIMEOUT: 'Google Sheets did not respond in time.',
  UPSTREAM_ERROR: 'Google Sheets returned an error.',
  MALFORMED_SHEET: 'The spreadsheet layout is not what the app expects.',
};
