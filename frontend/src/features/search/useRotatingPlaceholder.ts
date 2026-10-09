import { useEffect, useState } from 'react';

export const PLACEHOLDER_INTERVAL_MS = 1000;

/**
 * Cycles through `names` once per second while `paused` is false. With reduced motion the
 * placeholder stays on the first name instead of changing every second.
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
