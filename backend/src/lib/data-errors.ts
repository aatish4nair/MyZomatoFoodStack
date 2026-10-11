import type { DataErrorCode } from '@food-stack/shared';

/**
 * Why an UPSTREAM_AUTH failure happened, from a fixed list. Server logs only: never sent to the
 * browser. Chosen from error types, system error codes and HTTP status numbers, never from
 * messages or response bodies, so it can't carry credentials, emails, tokens or sheet contents.
 */
export const DATA_ERROR_REASONS = [
  /** Credential file: missing at the configured path. */
  'key-file-not-found',
  /** Credential file: exists but can't be read (permissions, or the path is a directory). */
  'key-file-unreadable',
  /** Credential file/JSON: not valid JSON (e.g. only a filename, or a truncated paste). */
  'key-invalid-json',
  /** Credential JSON: `private_key` or `client_email` missing. */
  'key-missing-fields',
  /** Private key present but unusable (e.g. line breaks lost or turned into literal "\n"). */
  'key-unusable',
  /** Google's token endpoint rejected the credentials (e.g. deleted key, wrong account type). */
  'token-rejected',
  /** Google's token endpoint couldn't be reached. */
  'token-network-error',
  /** The token request completed without a token. */
  'no-token',
  /** The Sheets API answered 401 (token not accepted). */
  'sheets-401',
  /** The Sheets API answered 403 (sheet not shared with the service account, or API disabled). */
  'sheets-403',
  /** Anything else during authentication. */
  'unknown-auth-error',
] as const;
export type DataErrorReason = (typeof DATA_ERROR_REASONS)[number];

/**
 * The order data could not be served. Carries only a safe code (and, for authentication failures,
 * a fixed-list reason for the server logs): the original error, which may contain Google's
 * messages, URLs or identifiers, is never forwarded to the browser or logged.
 */
export class DataUnavailableError extends Error {
  override readonly name = 'DataUnavailableError';
  constructor(
    readonly code: DataErrorCode,
    readonly reason?: DataErrorReason,
  ) {
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
