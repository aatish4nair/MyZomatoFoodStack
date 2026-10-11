import { generateKeyPairSync } from 'node:crypto';
import { chmodSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it, vi } from 'vitest';
import type { SheetsConfig } from '../../config/env.js';
import { DataUnavailableError } from '../../lib/data-errors.js';
import { checkCredentials, credentialsLookUsable, logCredentialCheck } from './credential-check.js';
import { authFailureReason, createSheetsReader } from './sheets-reader.js';

// Throwaway, locally generated key material. Not a real Google credential.
const PRIVATE_KEY = generateKeyPairSync('rsa', { modulusLength: 2048 })
  .privateKey.export({ type: 'pkcs8', format: 'pem' })
  .toString();
const EMAIL = 'diagnostics-test@fake-project.iam.gserviceaccount.com';
const SHEET_ID = 'sheet-id-that-must-never-be-logged-0123';
const KEY_ID = 'key-id-that-must-never-be-logged';
const base = {
  type: 'service_account',
  project_id: 'fake-project',
  private_key_id: KEY_ID,
  client_email: EMAIL,
  client_id: '1',
  token_uri: 'https://oauth2.googleapis.com/token',
};

const dir = mkdtempSync(join(tmpdir(), 'food-stack-auth-'));
afterAll(() => {
  chmodSync(join(dir, 'unreadable.json'), 0o600);
  rmSync(dir, { recursive: true, force: true });
});
const file = (name: string, content: string): string => {
  const path = join(dir, name);
  writeFileSync(path, content);
  return path;
};
const FILES = {
  good: file('good.json', JSON.stringify({ ...base, private_key: PRIVATE_KEY })),
  missing: join(dir, 'missing.json'),
  directory: (() => {
    const path = join(dir, 'a-directory.json');
    mkdirSync(path);
    return path;
  })(),
  unreadable: (() => {
    const path = file('unreadable.json', '{}');
    chmodSync(path, 0o000);
    return path;
  })(),
  filenameOnly: file('filename-only.json', 'service-account.json'),
  truncated: file(
    'truncated.json',
    JSON.stringify({ ...base, private_key: PRIVATE_KEY }).slice(0, 300),
  ),
  wrongType: file(
    'wrong-type.json',
    JSON.stringify({ ...base, type: 'authorized_user', private_key: PRIVATE_KEY }),
  ),
  noFields: file(
    'no-fields.json',
    JSON.stringify({ type: 'service_account', project_id: 'fake-project' }),
  ),
  oneLine: file(
    'one-line.json',
    JSON.stringify({ ...base, private_key: PRIVATE_KEY.replace(/\n/g, ' ') }),
  ),
  literalBackslashN: file(
    'literal-backslash-n.json',
    JSON.stringify({ ...base, private_key: PRIVATE_KEY.replace(/\n/g, '\\n') }),
  ),
  noMarkers: file('no-markers.json', JSON.stringify({ ...base, private_key: 'not-a-pem-key' })),
};

/** Every value that must never appear in a log line or an API response. */
const SECRETS = [
  EMAIL,
  KEY_ID,
  SHEET_ID,
  'BEGIN PRIVATE KEY',
  PRIVATE_KEY.split('\n')[1] ?? '',
  dir,
];

const configFor = (keyFile: string): SheetsConfig => ({
  spreadsheetId: SHEET_ID,
  range: "'Formatted Data'!A:J",
  credentials: { kind: 'key-file', path: keyFile },
  timeoutMs: 5000,
  cacheTtlMs: 60_000,
  maxRows: 100,
});

/** Reads with the REAL google-auth-library token source and returns the failure. */
async function failureFor(keyFile: string): Promise<DataUnavailableError> {
  const fetchSpy = vi.fn(() => Promise.reject(new Error('the sheet must not be requested')));
  const error = await createSheetsReader(configFor(keyFile), { fetch: fetchSpy })
    .readValues()
    .then(
      () => {
        throw new Error('expected a failure');
      },
      (e: unknown) => e,
    );
  expect(fetchSpy).not.toHaveBeenCalled();
  expect(error).toBeInstanceOf(DataUnavailableError);
  return error as DataUnavailableError;
}

describe('authentication failure reasons (real google-auth-library, no network)', () => {
  it.each([
    ['missing key file', FILES.missing, 'key-file-not-found'],
    ['path is a directory', FILES.directory, 'key-file-unreadable'],
    ['unreadable key file', FILES.unreadable, 'key-file-unreadable'],
    ['only the filename was pasted', FILES.filenameOnly, 'key-invalid-json'],
    ['truncated paste', FILES.truncated, 'key-invalid-json'],
    ['private_key and client_email missing', FILES.noFields, 'key-missing-fields'],
    ['private key on one line', FILES.oneLine, 'key-unusable'],
    ['private key with literal \\n text', FILES.literalBackslashN, 'key-unusable'],
  ] as const)('%s → UPSTREAM_AUTH / %s', async (_label, keyFile, reason) => {
    if (keyFile === FILES.unreadable && process.getuid?.() === 0) return; // root reads anything
    const error = await failureFor(keyFile);
    expect(error.code).toBe('UPSTREAM_AUTH');
    expect(error.reason).toBe(reason);
    // The safe error carries no detail from the original exception.
    expect(error.message).toBe('UPSTREAM_AUTH');
    for (const secret of SECRETS) expect(JSON.stringify(error)).not.toContain(secret);
  });
});

describe('authFailureReason (token endpoint and other shapes)', () => {
  const gaxiosLike = (props: object) =>
    Object.assign(new Error('raw message with fake@fake-project and tok3n'), {
      name: 'GaxiosError',
      ...props,
    });

  it('maps a token-endpoint rejection (HTTP response) to token-rejected', () => {
    expect(authFailureReason(gaxiosLike({ code: 400, response: { status: 400 } }))).toBe(
      'token-rejected',
    );
    expect(authFailureReason(gaxiosLike({ response: { status: 401 } }))).toBe('token-rejected');
  });

  it('maps an unreachable token endpoint (system code, no response) to token-network-error', () => {
    for (const code of ['ECONNREFUSED', 'ENOTFOUND', 'ETIMEDOUT', 'ECONNRESET', 'EAI_AGAIN']) {
      expect(authFailureReason(gaxiosLike({ code }))).toBe('token-network-error');
    }
  });

  it('falls back to unknown-auth-error for anything else', () => {
    expect(authFailureReason('a string')).toBe('unknown-auth-error');
    expect(authFailureReason(new Error('something else'))).toBe('unknown-auth-error');
    expect(authFailureReason(undefined)).toBe('unknown-auth-error');
  });
});

describe('Sheets API 401/403 and token outcomes', () => {
  const reader = (status: number, token: string | null = 'tok') =>
    createSheetsReader(configFor(FILES.good), {
      fetch: () => Promise.resolve(new Response('{"error":{"message":"raw body"}}', { status })),
      getAccessToken: () => Promise.resolve(token),
    });

  it.each([
    [401, 'UPSTREAM_AUTH', 'sheets-401'],
    [403, 'UPSTREAM_AUTH', 'sheets-403'],
    [404, 'UPSTREAM_NOT_FOUND', undefined],
    [429, 'UPSTREAM_QUOTA', undefined],
    [500, 'UPSTREAM_ERROR', undefined],
  ] as const)('HTTP %i → %s (reason %s)', async (status, code, reason) => {
    await expect(reader(status).readValues()).rejects.toMatchObject({ code, reason });
  });

  it('reports an empty token as no-token', async () => {
    await expect(reader(200, null).readValues()).rejects.toMatchObject({
      code: 'UPSTREAM_AUTH',
      reason: 'no-token',
    });
  });

  it('keeps a hanging token request as UPSTREAM_TIMEOUT (no auth reason)', async () => {
    const hanging = createSheetsReader(
      { ...configFor(FILES.good), timeoutMs: 20 },
      { fetch: vi.fn(), getAccessToken: () => new Promise(() => undefined) },
    );
    const error = await hanging.readValues().catch((e: unknown) => e);
    expect(error).toMatchObject({ code: 'UPSTREAM_TIMEOUT' });
    expect((error as DataUnavailableError).reason).toBeUndefined();
  });
});

describe('credential self-check', () => {
  const keyFile = (path: string) => ({ kind: 'key-file' as const, path });

  it('reports a usable service-account key file', () => {
    const check = checkCredentials(keyFile(FILES.good));
    expect(check).toEqual({
      source: 'key-file',
      fileFound: true,
      readable: true,
      validJson: true,
      isServiceAccount: true,
      hasClientEmail: true,
      hasPrivateKey: true,
      privateKeyFormat: 'ok',
    });
    expect(credentialsLookUsable(check)).toBe(true);
  });

  it.each([
    ['missing file', FILES.missing, { fileFound: false, readable: false, validJson: false }],
    ['directory', FILES.directory, { fileFound: true, readable: false, validJson: false }],
    ['filename only', FILES.filenameOnly, { readable: true, validJson: false }],
    ['truncated', FILES.truncated, { readable: true, validJson: false }],
    ['wrong type', FILES.wrongType, { validJson: true, isServiceAccount: false }],
    [
      'missing fields',
      FILES.noFields,
      { hasClientEmail: false, hasPrivateKey: false, privateKeyFormat: 'missing' },
    ],
    ['one-line key', FILES.oneLine, { hasPrivateKey: true, privateKeyFormat: 'no-line-breaks' }],
    [
      'literal \\n key',
      FILES.literalBackslashN,
      { hasPrivateKey: true, privateKeyFormat: 'no-line-breaks' },
    ],
    ['no PEM markers', FILES.noMarkers, { privateKeyFormat: 'no-pem-markers' }],
  ] as const)('flags a %s', (_label, path, expected) => {
    const check = checkCredentials(keyFile(path));
    expect(check).toMatchObject(expected);
    expect(credentialsLookUsable(check)).toBe(false);
  });

  it('flags an unreadable file without guessing its contents', () => {
    if (process.getuid?.() === 0) return;
    expect(checkCredentials(keyFile(FILES.unreadable))).toMatchObject({
      fileFound: true,
      readable: false,
      validJson: false,
    });
  });

  it('checks inline JSON credentials the same way (no file facts)', () => {
    const check = checkCredentials({
      kind: 'json',
      json: JSON.stringify({ ...base, private_key: PRIVATE_KEY }),
    });
    expect(check).toMatchObject({ source: 'json', validJson: true, privateKeyFormat: 'ok' });
    expect(check).not.toHaveProperty('fileFound');
  });

  it('logs only yes/no facts: info when usable, warn with the facts otherwise', () => {
    const lines: { level: string; object: object; message: string }[] = [];
    const log = {
      info: (object: object, message: string) => lines.push({ level: 'info', object, message }),
      warn: (object: object, message: string) => lines.push({ level: 'warn', object, message }),
    };
    for (const path of Object.values(FILES)) logCredentialCheck(log, keyFile(path));
    expect(lines.filter((l) => l.level === 'info')).toHaveLength(1); // only the good file
    expect(lines.map((l) => l.message)).toContain('Google credential self-check found a problem');
    const captured = JSON.stringify(lines);
    for (const secret of SECRETS) expect(captured).not.toContain(secret);
    expect(captured).not.toContain('fake-project');
    // Only these keys ever appear in the logged facts.
    const allowed = [
      'source',
      'fileFound',
      'readable',
      'validJson',
      'isServiceAccount',
      'hasClientEmail',
      'hasPrivateKey',
      'privateKeyFormat',
    ];
    for (const line of lines) {
      const facts = (line.object as { credentialCheck: object }).credentialCheck;
      for (const key of Object.keys(facts)) expect(allowed).toContain(key);
    }
  });
});
