import { describe, expect, it } from 'vitest';
import { convexHull, opaqueBounds, traceOutline } from './sprite-shape';

/** A 40x40 image with an opaque disc of radius 10 centred at (20, 20). */
const SIZE = 40;
const disc = (i: number): number => {
  const x = i % SIZE;
  const y = Math.floor(i / SIZE);
  return (x - 20) ** 2 + (y - 20) ** 2 <= 100 ? 255 : 0;
};

describe('sprite outline', () => {
  it('finds the opaque bounding box', () => {
    expect(opaqueBounds(disc, SIZE, SIZE)).toEqual({ x0: 10, y0: 10, x1: 30, y1: 30 });
    expect(opaqueBounds(() => 0, SIZE, SIZE)).toBeNull();
  });

  it('computes a convex hull', () => {
    const square = [
      { x: 0, y: 0 },
      { x: 2, y: 0 },
      { x: 1, y: 1 }, // interior point, must be dropped
      { x: 2, y: 2 },
      { x: 0, y: 2 },
    ];
    expect(convexHull(square)).toHaveLength(4);
  });

  it('traces a normalised outline of at most 16 points', () => {
    const bounds = opaqueBounds(disc, SIZE, SIZE);
    if (!bounds) throw new Error('expected bounds');
    const outline = traceOutline(disc, SIZE, bounds, { rowStep: 1 });
    expect(outline.length).toBeGreaterThanOrEqual(3);
    expect(outline.length).toBeLessThanOrEqual(16);
    for (const p of outline) {
      expect(Math.abs(p.x)).toBeLessThanOrEqual(0.5);
      expect(Math.abs(p.y)).toBeLessThanOrEqual(0.5);
    }
  });
});
