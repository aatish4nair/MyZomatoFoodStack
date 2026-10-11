import { describe, expect, it } from 'vitest';
import { allowedHostnames, loadEnv, sheetsConfig } from './env.js';

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

  it.each(['0.0.0.0', '192.168.1.5', '::'])(
    'refuses to bind to non-loopback HOST=%s outside production',
    (host) => {
      expect(() => loadEnv({ HOST: host })).toThrow('HOST');
      expect(() => loadEnv({ HOST: host, ALLOWED_HOSTS: 'my-api.onrender.com' })).toThrow('HOST');
    },
  );
});

describe('production deployment settings', () => {
  const PROD = { NODE_ENV: 'production', HOST: '0.0.0.0' };

  it('binds to all interfaces in production when the allowed hostnames are named', () => {
    expect(loadEnv({ ...PROD, ALLOWED_HOSTS: 'my-api.onrender.com' }).HOST).toBe('0.0.0.0');
    expect(loadEnv({ ...PROD, RENDER_EXTERNAL_HOSTNAME: 'my-api.onrender.com' }).HOST).toBe(
      '0.0.0.0',
    );
    expect(loadEnv({ ...PROD, HOST: '::', ALLOWED_HOSTS: 'my-api.onrender.com' }).HOST).toBe('::');
  });

  it('refuses a public bind without allowed hostnames (validation is never switched off)', () => {
    expect(() => loadEnv(PROD)).toThrow('ALLOWED_HOSTS');
  });

  it('never accepts an arbitrary address, even in production', () => {
    expect(() =>
      loadEnv({ ...PROD, HOST: '192.168.1.5', ALLOWED_HOSTS: 'my-api.onrender.com' }),
    ).toThrow('HOST');
  });

  it.each([
    'https://my-api.onrender.com',
    'my-api.onrender.com:443',
    '*',
    'my api.com',
    'localhost:3000/x',
  ])('rejects ALLOWED_HOSTS entry %j (bare hostnames only)', (entry) => {
    expect(() => loadEnv({ ALLOWED_HOSTS: entry })).toThrow('ALLOWED_HOSTS');
  });

  it('combines localhost, ALLOWED_HOSTS and the Render hostname, lower-cased', () => {
    const env = loadEnv({
      ...PROD,
      ALLOWED_HOSTS: 'My-Site.onrender.com, my-api.onrender.com',
      RENDER_EXTERNAL_HOSTNAME: 'my-api.onrender.com',
    });
    expect(allowedHostnames(env)).toEqual([
      'localhost',
      '127.0.0.1',
      '[::1]',
      'my-site.onrender.com',
      'my-api.onrender.com',
    ]);
    expect(allowedHostnames(loadEnv({}))).toEqual(['localhost', '127.0.0.1', '[::1]']);
  });

  it('trusts proxy headers only in production', () => {
    expect(loadEnv({}).TRUST_PROXY_HOPS).toBe(0);
    expect(() => loadEnv({ TRUST_PROXY_HOPS: '1' })).toThrow('TRUST_PROXY_HOPS');
    expect(
      loadEnv({ ...PROD, ALLOWED_HOSTS: 'my-api.onrender.com', TRUST_PROXY_HOPS: '1' })
        .TRUST_PROXY_HOPS,
    ).toBe(1);
    expect(() =>
      loadEnv({ ...PROD, ALLOWED_HOSTS: 'a.example.com', TRUST_PROXY_HOPS: '9' }),
    ).toThrow('TRUST_PROXY_HOPS');
  });

  it('accepts a Render Secret File path for the service-account key', () => {
    const env = loadEnv({
      ...PROD,
      ALLOWED_HOSTS: 'my-api.onrender.com',
      GOOGLE_SHEET_ID: 'abcdefghijklmnopqrstuvwxyz0123456789',
      GOOGLE_SERVICE_ACCOUNT_KEY_FILE: '/etc/secrets/service-account.json',
    });
    expect(sheetsConfig(env)?.credentials).toEqual({
      kind: 'key-file',
      path: '/etc/secrets/service-account.json',
    });
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
