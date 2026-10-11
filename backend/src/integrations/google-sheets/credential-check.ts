import { readFileSync } from 'node:fs';
import type { SheetCredentials } from '../../config/env.js';

/**
 * Shape of the configured service-account credential, as yes/no facts. It never contains the
 * key, the service-account email, the project, the path or any other value from the file.
 */
export interface CredentialCheck {
  source: SheetCredentials['kind'];
  /** Key file only: a file exists at the configured path. */
  fileFound?: boolean;
  /** Key file only: the file could be read. */
  readable?: boolean;
  validJson: boolean;
  /** `type` is `service_account`. */
  isServiceAccount: boolean;
  hasClientEmail: boolean;
  hasPrivateKey: boolean;
  /**
   * `ok`: a PEM block with real line breaks. `no-pem-markers`: the BEGIN/END lines are missing.
   * `no-line-breaks`: everything is on one line (often literal "\n" text after copy-paste).
   */
  privateKeyFormat: 'ok' | 'missing' | 'no-pem-markers' | 'no-line-breaks';
}

const NOTHING = {
  validJson: false,
  isServiceAccount: false,
  hasClientEmail: false,
  hasPrivateKey: false,
  privateKeyFormat: 'missing',
} as const;

const PEM = /-----BEGIN PRIVATE KEY-----[\s\S]+-----END PRIVATE KEY-----/;

/**
 * Inspects the configured credential once (synchronously, at startup) and reports only its shape.
 * Reading errors are reduced to found/readable flags; no exception message is kept.
 */
export function checkCredentials(credentials: SheetCredentials): CredentialCheck {
  let text: string;
  let fileFacts: Pick<CredentialCheck, 'fileFound' | 'readable'> = {};
  if (credentials.kind === 'key-file') {
    try {
      text = readFileSync(credentials.path, 'utf8');
      fileFacts = { fileFound: true, readable: true };
    } catch (error) {
      const code = (error as { code?: unknown }).code;
      return {
        source: credentials.kind,
        fileFound: code !== 'ENOENT',
        readable: false,
        ...NOTHING,
      };
    }
  } else {
    text = credentials.json;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { source: credentials.kind, ...fileFacts, ...NOTHING };
  }
  const json = (typeof parsed === 'object' && parsed !== null ? parsed : {}) as Record<
    string,
    unknown
  >;
  const nonEmpty = (value: unknown): value is string =>
    typeof value === 'string' && value.trim() !== '';
  const key = json['private_key'];
  return {
    source: credentials.kind,
    ...fileFacts,
    validJson: true,
    isServiceAccount: json['type'] === 'service_account',
    hasClientEmail: nonEmpty(json['client_email']),
    hasPrivateKey: nonEmpty(key),
    privateKeyFormat: !nonEmpty(key)
      ? 'missing'
      : !PEM.test(key)
        ? 'no-pem-markers'
        : key.trim().includes('\n')
          ? 'ok'
          : 'no-line-breaks',
  };
}

/** True when every fact is as expected for a usable service-account key. */
export const credentialsLookUsable = (check: CredentialCheck): boolean =>
  check.fileFound !== false &&
  check.readable !== false &&
  check.validJson &&
  check.isServiceAccount &&
  check.hasClientEmail &&
  check.hasPrivateKey &&
  check.privateKeyFormat === 'ok';

interface MinimalLogger {
  info: (object: object, message: string) => void;
  warn: (object: object, message: string) => void;
}

/** Logs the self-check once: info when the key looks usable, warn (with the facts) otherwise. */
export function logCredentialCheck(log: MinimalLogger, credentials: SheetCredentials): void {
  const credentialCheck = checkCredentials(credentials);
  if (credentialsLookUsable(credentialCheck)) {
    log.info({ credentialCheck }, 'Google credential self-check passed');
  } else {
    log.warn({ credentialCheck }, 'Google credential self-check found a problem');
  }
}
