import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach, vi } from 'vitest';

const media = { reduce: false, finePointer: false };

/** Test helper: pretend the user does (or doesn't) prefer reduced motion. */
export function setReducedMotion(reduce: boolean): void {
  media.reduce = reduce;
  applyMedia();
}

/** Test helper: pretend the device has (or hasn't) a mouse or trackpad. jsdom default: touch-like. */
export function setFinePointer(fine: boolean): void {
  media.finePointer = fine;
  applyMedia();
}

function applyMedia(): void {
  window.matchMedia = vi.fn((query: string) => ({
    matches:
      (media.reduce && query.includes('prefers-reduced-motion')) ||
      (media.finePointer && query.includes('pointer: fine')),
    media: query,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(() => false),
  }));
}

setReducedMotion(false);

// jsdom has no canvas drawing; the pile code skips drawing when no context is available.
HTMLCanvasElement.prototype.getContext = vi.fn(() => null);

afterEach(() => {
  cleanup();
  media.finePointer = false;
  setReducedMotion(false);
  vi.useRealTimers();
  vi.restoreAllMocks();
});
