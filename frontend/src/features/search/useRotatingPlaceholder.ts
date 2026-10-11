import { useEffect, useState } from 'react';

/** How long each name stays visible: comfortably over one second, for a calmer rotation. */
export const PLACEHOLDER_INTERVAL_MS = 1800;

/**
 * Cycles through `names`, one every PLACEHOLDER_INTERVAL_MS, while `paused` is false. The first name
 * shows immediately, and each pause or resume restarts the interval, so every name stays visible
 * for the full interval. With reduced motion the placeholder stays on the first name.
 * Returns the name to show (empty string when there are no names).
 */
export function useRotatingPlaceholder(
  names: readonly string[],
  { paused, reducedMotion }: { paused: boolean; reducedMotion: boolean },
): string {
  const [index, setIndex] = useState(0);
  const count = names.length;
  const animate = !paused && !reducedMotion && count > 1;

  useEffect(() => {
    if (!animate) return;
    const timer = setInterval(() => {
      setIndex((i) => (i + 1) % count);
    }, PLACEHOLDER_INTERVAL_MS);
    return () => {
      clearInterval(timer);
    };
  }, [animate, count]);

  if (count === 0) return '';
  return reducedMotion ? (names[0] ?? '') : (names[index % count] ?? '');
}
