import Matter from 'matter-js';
import { describe, expect, it, vi } from 'vitest';
import { computePileLayout, seededRandom } from './pile-layout';
import { createPileSimulation, MAX_SIMULATED_MS, type PileItemSpec } from './pile-simulation';

const hexagon = Array.from({ length: 6 }, (_, i) => ({
  x: 0.5 * Math.cos((i * Math.PI) / 3),
  y: 0.5 * Math.sin((i * Math.PI) / 3),
}));

function items(count: number, size: number, random: () => number): PileItemSpec[] {
  return Array.from({ length: count }, (_, id) => ({
    id,
    width: size * (0.85 + random() * 0.3),
    height: size * (0.6 + random() * 0.4),
    hull: id % 2 === 0 ? hexagon : null,
  }));
}

describe('pile simulation', () => {
  it.each([
    ['phone', 375, 150],
    ['laptop', 1440, 220],
  ])('%s: settles with every kept item inside the footer zone', (_label, width, zoneHeight) => {
    const random = seededRandom(42);
    const layout = computePileLayout(width, zoneHeight);
    const specs = items(layout.itemCount, layout.itemSize, random);
    const sim = createPileSimulation({ width, zoneHeight, dropHeight: 600, items: specs, random });

    expect(sim.isSettled()).toBe(false);
    sim.settleNow();
    expect(sim.isSettled()).toBe(true);

    const final = sim.finalLayout();
    // Dense: most items stay in the collage.
    expect(final.length).toBeGreaterThan(specs.length * 0.5);
    for (const p of final) {
      const spec = specs[p.id];
      if (!spec) throw new Error('unknown item');
      const half = Math.max(spec.width, spec.height) / 2;
      // Centres within the zone horizontally; nothing pokes above the zone top (over the UI).
      expect(p.x).toBeGreaterThanOrEqual(0);
      expect(p.x).toBeLessThanOrEqual(width);
      expect(p.y + half).toBeGreaterThan(0);
      expect(p.y).toBeLessThan(zoneHeight + half);
    }
    sim.destroy();
  });

  it('stops within the time budget even if items never sleep', () => {
    const sim = createPileSimulation({
      width: 300,
      zoneHeight: 120,
      dropHeight: 0,
      items: items(10, 50, seededRandom(3)),
      random: seededRandom(3),
    });
    sim.step(MAX_SIMULATED_MS);
    expect(sim.isSettled()).toBe(true);
    sim.destroy();
  });

  it('frees the engine on destroy, and destroy is idempotent', () => {
    const clear = vi.spyOn(Matter.Engine, 'clear');
    const sim = createPileSimulation({
      width: 300,
      zoneHeight: 120,
      dropHeight: 0,
      items: items(5, 50, seededRandom(4)),
      random: seededRandom(4),
    });
    sim.destroy();
    sim.destroy();
    expect(clear).toHaveBeenCalledTimes(1);
    expect(sim.isSettled()).toBe(true);
  });
});
