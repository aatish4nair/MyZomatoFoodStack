import { describe, expect, it, vi } from 'vitest';
import { DataUnavailableError } from '../../lib/data-errors.js';
import { HEADER, row } from '../../test/sheet-fixtures.js';
import { createOrderRepository } from './order-repository.js';

const rows = [HEADER, row()];

function setup(readValues: () => Promise<unknown[][]>) {
  let time = 1_000_000;
  const reader = { readValues: vi.fn(readValues) };
  const repo = createOrderRepository(reader, { ttlMs: 60_000, maxRows: 100, now: () => time });
  return { reader, repo, advance: (ms: number) => (time += ms) };
}

describe('order repository cache', () => {
  it('reports NOT_CONFIGURED without a reader', async () => {
    const repo = createOrderRepository(null, { ttlMs: 1000, maxRows: 10 });
    await expect(repo.getSnapshot()).rejects.toMatchObject({ code: 'NOT_CONFIGURED' });
  });

  it('reuses a snapshot within the TTL and refreshes after it', async () => {
    const { reader, repo, advance } = setup(() => Promise.resolve(rows));
    await repo.getSnapshot();
    advance(59_000);
    await repo.getSnapshot();
    expect(reader.readValues).toHaveBeenCalledTimes(1);
    advance(2_000);
    await repo.getSnapshot();
    expect(reader.readValues).toHaveBeenCalledTimes(2);
  });

  it('shares one in-flight read between concurrent requests', async () => {
    const { reader, repo } = setup(() => Promise.resolve(rows));
    await Promise.all([repo.getSnapshot(), repo.getSnapshot(), repo.getSnapshot()]);
    expect(reader.readValues).toHaveBeenCalledTimes(1);
  });

  it('serves the last good snapshot marked stale when a refresh fails', async () => {
    let fail = false;
    const { repo, advance } = setup(() =>
      fail ? Promise.reject(new DataUnavailableError('UPSTREAM_QUOTA')) : Promise.resolve(rows),
    );
    expect((await repo.getSnapshot()).stale).toBe(false);
    fail = true;
    advance(61_000);
    const snapshot = await repo.getSnapshot();
    expect(snapshot.stale).toBe(true);
    expect(snapshot.orders).toHaveLength(1);
  });

  it('does not hammer Google after a failure: waits before retrying', async () => {
    const { reader, repo, advance } = setup(() =>
      Promise.reject(new DataUnavailableError('UPSTREAM_TIMEOUT')),
    );
    await expect(repo.getSnapshot()).rejects.toMatchObject({ code: 'UPSTREAM_TIMEOUT' });
    await expect(repo.getSnapshot()).rejects.toMatchObject({ code: 'UPSTREAM_TIMEOUT' });
    expect(reader.readValues).toHaveBeenCalledTimes(1);
    advance(6_000);
    await expect(repo.getSnapshot()).rejects.toBeInstanceOf(DataUnavailableError);
    expect(reader.readValues).toHaveBeenCalledTimes(2);
  });

  it('turns unexpected errors into a safe code', async () => {
    const { repo } = setup(() => Promise.reject(new Error('socket hang up at 10.0.0.1')));
    await expect(repo.getSnapshot()).rejects.toMatchObject({ code: 'UPSTREAM_ERROR' });
  });

  it('refuses unbounded sheets', async () => {
    const big = [HEADER, ...Array.from({ length: 101 }, () => row())];
    const { repo } = setup(() => Promise.resolve(big));
    await expect(repo.getSnapshot()).rejects.toMatchObject({ code: 'MALFORMED_SHEET' });
  });
});
