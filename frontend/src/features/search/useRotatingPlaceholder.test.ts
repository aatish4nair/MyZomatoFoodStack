import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PLACEHOLDER_INTERVAL_MS, useRotatingPlaceholder } from './useRotatingPlaceholder';

const NAMES = ['Idly', 'Masala Dosa', 'Tandoori Chicken'];

const advance = (ms: number) => {
  act(() => {
    vi.advanceTimersByTime(ms);
  });
};

describe('useRotatingPlaceholder', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  it('shows the first name at once and keeps each name for 1.5–2 seconds, wrapping around', () => {
    const { result } = renderHook(() =>
      useRotatingPlaceholder(NAMES, { paused: false, reducedMotion: false }),
    );
    expect(PLACEHOLDER_INTERVAL_MS).toBeGreaterThanOrEqual(1500);
    expect(PLACEHOLDER_INTERVAL_MS).toBeLessThanOrEqual(2000);
    expect(result.current).toBe('Idly');
    advance(1000);
    expect(result.current).toBe('Idly'); // still visible after a full second
    advance(PLACEHOLDER_INTERVAL_MS - 1001);
    expect(result.current).toBe('Idly');
    advance(1);
    expect(result.current).toBe('Masala Dosa');
    advance(PLACEHOLDER_INTERVAL_MS);
    expect(result.current).toBe('Tandoori Chicken');
    advance(PLACEHOLDER_INTERVAL_MS);
    expect(result.current).toBe('Idly');
  });

  it('stops while paused and resumes from the same name', () => {
    const { result, rerender } = renderHook(
      ({ paused }) => useRotatingPlaceholder(NAMES, { paused, reducedMotion: false }),
      { initialProps: { paused: false } },
    );
    advance(PLACEHOLDER_INTERVAL_MS);
    expect(result.current).toBe('Masala Dosa');
    rerender({ paused: true });
    advance(PLACEHOLDER_INTERVAL_MS * 3);
    expect(result.current).toBe('Masala Dosa');
    expect(vi.getTimerCount()).toBe(0); // no timer while paused
    rerender({ paused: false });
    advance(PLACEHOLDER_INTERVAL_MS);
    expect(result.current).toBe('Tandoori Chicken');
  });

  it('shows a stable placeholder with reduced motion', () => {
    const { result } = renderHook(() =>
      useRotatingPlaceholder(NAMES, { paused: false, reducedMotion: true }),
    );
    advance(5000);
    expect(result.current).toBe('Idly');
    expect(vi.getTimerCount()).toBe(0);
  });

  it('handles an empty list and a single name without timers', () => {
    const empty = renderHook(() =>
      useRotatingPlaceholder([], { paused: false, reducedMotion: false }),
    );
    expect(empty.result.current).toBe('');
    const single = renderHook(() =>
      useRotatingPlaceholder(['Idly'], { paused: false, reducedMotion: false }),
    );
    expect(single.result.current).toBe('Idly');
    expect(vi.getTimerCount()).toBe(0);
  });

  it('keeps a single interval across re-renders and clears it on unmount', () => {
    const { unmount, rerender } = renderHook(() =>
      useRotatingPlaceholder(NAMES, { paused: false, reducedMotion: false }),
    );
    expect(vi.getTimerCount()).toBe(1);
    rerender();
    rerender();
    expect(vi.getTimerCount()).toBe(1);
    unmount();
    expect(vi.getTimerCount()).toBe(0);
  });
});
