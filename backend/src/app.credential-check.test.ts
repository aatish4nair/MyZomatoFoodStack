import { afterEach, describe, expect, it, vi } from 'vitest';
import { buildApp } from './app.js';
import { loadEnv } from './config/env.js';

const { logCredentialCheck } = vi.hoisted(() => ({ logCredentialCheck: vi.fn() }));
vi.mock('./integrations/google-sheets/credential-check.js', () => ({ logCredentialCheck }));

const SHEET = { GOOGLE_SHEET_ID: 'abcdefghijklmnopqrstuvwxyz0123456789' };
afterEach(() => {
  logCredentialCheck.mockClear();
});

describe('startup credential self-check', () => {
  it('runs once, at build time, when the real Google reader is configured', async () => {
    const app = await buildApp(
      loadEnv({
        NODE_ENV: 'test',
        ...SHEET,
        GOOGLE_SERVICE_ACCOUNT_KEY_FILE: '/etc/secrets/service-account.json',
      }),
    );
    expect(logCredentialCheck).toHaveBeenCalledTimes(1);
    expect(logCredentialCheck).toHaveBeenCalledWith(app.log, {
      kind: 'key-file',
      path: '/etc/secrets/service-account.json',
    });
    await app.close();
  });

  it('does not run without a configured sheet, or with an injected reader (tests)', async () => {
    const unconfigured = await buildApp(loadEnv({ NODE_ENV: 'test' }));
    const injected = await buildApp(
      loadEnv({ NODE_ENV: 'test', ...SHEET, GOOGLE_SERVICE_ACCOUNT_KEY_FILE: '/x/key.json' }),
      { sheetsReader: { readValues: () => Promise.resolve([]) } },
    );
    expect(logCredentialCheck).not.toHaveBeenCalled();
    await unconfigured.close();
    await injected.close();
  });
});
