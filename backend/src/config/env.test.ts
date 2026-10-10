import { describe, expect, it } from 'vitest';
import { loadEnv, sheetsConfig } from './env.js';

describe('loadEnv', () => {
  it('applies safe defaults (loopback host, local frontend origin)', () => {
    const env = loadEnv({});
    expect(env.HOST).toBe('127.0.0.1');
    expect(env.PORT).toBe(3000);
    expect(env.CORS_ORIGINS).toEqual(['http://localhost:5173']);
  });

  it('parses a comma-separated origin list', () => {
    const env = loadEnv({ CORS_ORIGINS: 'http://localhost:5173, https://food.example.com' });
    expect(env.CORS_ORIGINS).toEqual(['http://localhost:5173', 'https://food.example.com']);
  });

  it.each([
    ['PORT', 'not-a-number'],
    ['PORT', '70000'],
    ['NODE_ENV', 'staging'],
    ['CORS_ORIGINS', '*'],
    ['CORS_ORIGINS', 'https://example.com/path'],
  ])('rejects %s=%s', (name, value) => {
    expect(() => loadEnv({ [name]: value })).toThrow(name);
  });

  it('does not echo the rejected value in the error message', () => {
    const secretLooking = 'super-secret-value-123';
    expect(() => loadEnv({ PORT: secretLooking })).toThrow(
      expect.objectContaining({ message: expect.not.stringContaining(secretLooking) as string }),
    );
  });

  it.each(['0.0.0.0', '192.168.1.5', '::'])('refuses to bind to non-loopback HOST=%s', (host) => {
    expect(() => loadEnv({ HOST: host })).toThrow('HOST');
  });
});

describe('Google Sheets configuration', () => {
  const SHEET = 'abcdefghijklmnopqrstuvwxyz0123456789';
  const KEY_JSON = JSON.stringify({
    type: 'service_account',
    client_email: 'robot@example.iam.gserviceaccount.com',
    private_key: '-----BEGIN PRIVATE KEY-----\\nFAKE\\n-----END PRIVATE KEY-----\\n',
  });

  it('is "not configured" (null) when nothing is set', () => {
    expect(sheetsConfig(loadEnv({}))).toBeNull();
  });

  it('accepts a key file path with a sheet ID and defaults the range', () => {
    const config = sheetsConfig(
      loadEnv({
        GOOGLE_SHEET_ID: SHEET,
        GOOGLE_SERVICE_ACCOUNT_KEY_FILE: '/Users/me/keys/sa.json',
      }),
    );
    expect(config).toMatchObject({
      spreadsheetId: SHEET,
      range: "'Formatted Data'!A:J",
      credentials: { kind: 'key-file', path: '/Users/me/keys/sa.json' },
      cacheTtlMs: 60_000,
    });
  });

  it('accepts inline service-account JSON', () => {
    const config = sheetsConfig(
      loadEnv({ GOOGLE_SHEET_ID: SHEET, GOOGLE_SERVICE_ACCOUNT_JSON: KEY_JSON }),
    );
    expect(config?.credentials.kind).toBe('json');
  });

  it.each([
    ['sheet ID without credentials', { GOOGLE_SHEET_ID: SHEET }],
    ['credentials without sheet ID', { GOOGLE_SERVICE_ACCOUNT_KEY_FILE: '/k.json' }],
    [
      'both credential kinds',
      {
        GOOGLE_SHEET_ID: SHEET,
        GOOGLE_SERVICE_ACCOUNT_KEY_FILE: '/k.json',
        GOOGLE_SERVICE_ACCOUNT_JSON: KEY_JSON,
      },
    ],
    [
      'relative key path',
      { GOOGLE_SHEET_ID: SHEET, GOOGLE_SERVICE_ACCOUNT_KEY_FILE: 'keys/sa.json' },
    ],
    [
      'unbounded range',
      {
        GOOGLE_SHEET_ID: SHEET,
        GOOGLE_SERVICE_ACCOUNT_KEY_FILE: '/k.json',
        GOOGLE_SHEET_RANGE: 'Formatted Data',
      },
    ],
    [
      'a sheet URL instead of an ID',
      {
        GOOGLE_SHEET_ID: 'https://docs.google.com/spreadsheets/d/x',
        GOOGLE_SERVICE_ACCOUNT_KEY_FILE: '/k.json',
      },
    ],
  ])('rejects %s', (_label, vars) => {
    expect(() => loadEnv(vars)).toThrow('Invalid environment configuration');
  });

  it('never echoes credential values in configuration errors', () => {
    const secret = '{"type":"service_account","private_key":"SUPER-SECRET-KEY"';
    expect(() => loadEnv({ GOOGLE_SHEET_ID: SHEET, GOOGLE_SERVICE_ACCOUNT_JSON: secret })).toThrow(
      expect.objectContaining({
        message: expect.not.stringContaining('SUPER-SECRET-KEY') as string,
      }),
    );
  });
});
