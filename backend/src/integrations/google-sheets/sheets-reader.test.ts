import { describe, expect, it, vi } from 'vitest';
import type { SheetsConfig } from '../../config/env.js';
import { createSheetsReader, SHEETS_READONLY_SCOPE } from './sheets-reader.js';

const config: SheetsConfig = {
  spreadsheetId: 'test-spreadsheet-id-0123456789',
  range: "'Formatted Data'!A:J",
  credentials: { kind: 'json', json: '{}' },
  timeoutMs: 1000,
  cacheTtlMs: 60_000,
  maxRows: 100,
};

const respond = (status: number, body: unknown) =>
  vi.fn(() => Promise.resolve(new Response(JSON.stringify(body), { status })));

const reader = (
  fetchImpl: typeof fetch,
  token: () => Promise<string | null> = () => Promise.resolve('tok'),
) => createSheetsReader(config, { fetch: fetchImpl, getAccessToken: token });

describe('Google Sheets reader', () => {
  it('requests only the read-only scope', () => {
    expect(SHEETS_READONLY_SCOPE).toBe('https://www.googleapis.com/auth/spreadsheets.readonly');
  });

  it('reads unformatted values from the configured range with a bearer token', async () => {
    const fetchImpl = respond(200, { values: [['a', 1]] });
    await expect(reader(fetchImpl).readValues()).resolves.toEqual([['a', 1]]);
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toContain('/v4/spreadsheets/test-spreadsheet-id-0123456789/values/');
    expect(url).toContain(encodeURIComponent("'Formatted Data'!A:J"));
    expect(url).toContain('valueRenderOption=UNFORMATTED_VALUE');
    expect(init.headers).toMatchObject({ Authorization: 'Bearer tok' });
  });

  it('treats an empty sheet (no values) as zero rows', async () => {
    await expect(reader(respond(200, {})).readValues()).resolves.toEqual([]);
  });

  it.each([
    [401, 'UPSTREAM_AUTH'],
    [403, 'UPSTREAM_AUTH'],
    [404, 'UPSTREAM_NOT_FOUND'],
    [400, 'UPSTREAM_NOT_FOUND'],
    [429, 'UPSTREAM_QUOTA'],
    [500, 'UPSTREAM_ERROR'],
    [503, 'UPSTREAM_ERROR'],
  ])('maps HTTP %d to %s', async (status, code) => {
    const fetchImpl = respond(status, {
      error: { message: 'raw google detail: caller does not have permission' },
    });
    await expect(reader(fetchImpl).readValues()).rejects.toMatchObject({ code });
  });

  it('maps a timeout to UPSTREAM_TIMEOUT', async () => {
    const timeout = Object.assign(new Error('aborted'), { name: 'TimeoutError' });
    await expect(reader(vi.fn(() => Promise.reject(timeout))).readValues()).rejects.toMatchObject({
      code: 'UPSTREAM_TIMEOUT',
    });
  });

  it('maps network failures to UPSTREAM_ERROR', async () => {
    await expect(
      reader(vi.fn(() => Promise.reject(new TypeError('fetch failed')))).readValues(),
    ).rejects.toMatchObject({
      code: 'UPSTREAM_ERROR',
    });
  });

  it('maps credential failures (bad key, no token) to UPSTREAM_AUTH', async () => {
    const fetchImpl = respond(200, { values: [] });
    await expect(
      reader(fetchImpl, () => Promise.reject(new Error('invalid_grant: bad key'))).readValues(),
    ).rejects.toMatchObject({
      code: 'UPSTREAM_AUTH',
    });
    await expect(reader(fetchImpl, () => Promise.resolve(null)).readValues()).rejects.toMatchObject(
      { code: 'UPSTREAM_AUTH' },
    );
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('maps a hanging token request to UPSTREAM_TIMEOUT', async () => {
    vi.useFakeTimers();
    const pending = reader(respond(200, {}), () => new Promise(() => undefined)).readValues();
    const assertion = expect(pending).rejects.toMatchObject({ code: 'UPSTREAM_TIMEOUT' });
    await vi.advanceTimersByTimeAsync(1000);
    await assertion;
    vi.useRealTimers();
  });

  it('rejects unexpected response shapes as MALFORMED_SHEET', async () => {
    await expect(reader(respond(200, { values: 'nope' })).readValues()).rejects.toMatchObject({
      code: 'MALFORMED_SHEET',
    });
    const notJson = vi.fn(() => Promise.resolve(new Response('<html>', { status: 200 })));
    await expect(reader(notJson).readValues()).rejects.toMatchObject({ code: 'MALFORMED_SHEET' });
  });
});
