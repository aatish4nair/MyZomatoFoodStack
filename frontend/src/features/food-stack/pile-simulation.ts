import Matter from 'matter-js';
import type { Point } from './sprite-shape';

/**
 * Matter.js physics for the footer pile, with no React or DOM code.
 *
 * Coordinates: x runs 0..width; y = 0 is the TOP of the footer zone and y = zoneHeight its
 * bottom. Items start above the zone (negative y), fall, collide and settle on a floor slightly
 * below the zone's bottom edge, so the collage looks cut off by the screen edge as in the design.
 */

export interface PileItemSpec {
  id: number;
  /** Size of the visible picture, in CSS pixels. */
  width: number;
  height: number;
  /** Convex outline normalised to -0.5..0.5, or null for a rounded box. */
  hull: readonly Point[] | null;
}

export interface Placement {
  id: number;
  x: number;
  y: number;
  angle: number;
  /** Where the picture's centre sits relative to the body's centre of mass (body space). */
  offsetX: number;
  offsetY: number;
}

export interface SimulationOptions {
  width: number;
  zoneHeight: number;
  /** Distance from the top of the viewport to the top of the zone; items start above this. */
  dropHeight: number;
  items: readonly PileItemSpec[];
  random: () => number;
}

export interface PileSimulation {
  /** Advances the simulation by `ms` (internally in fixed steps of at most 1/60 s). */
  step(ms: number): void;
  /** True once every item is at rest, or the time budget has run out. */
  isSettled(): boolean;
  /** Runs synchronously until settled (used for reduced motion, hidden tabs and resizes). */
  settleNow(): void;
  /** Current positions of every item (for drawing frames). */
  positions(): Placement[];
  /** Final layout: only items lying fully inside the zone, so nothing covers the page above. */
  finalLayout(): Placement[];
  /** Removes every body and frees the engine. Safe to call more than once. */
  destroy(): void;
}

export const STEP_MS = 1000 / 60;
/** Upper bound on simulated time, so a jittering item can never keep the loop alive. */
export const MAX_SIMULATED_MS = 7000;

const BODY_OPTIONS: Matter.IChamferableBodyDefinition = {
  friction: 0.6,
  frictionStatic: 0.9,
  restitution: 0.18,
  density: 0.002,
  slop: 0.03,
  sleepThreshold: 30,
};

export function createPileSimulation(options: SimulationOptions): PileSimulation {
  const { width, zoneHeight, dropHeight, items, random } = options;
  const engine = Matter.Engine.create({
    enableSleeping: true,
    positionIterations: 8,
    velocityIterations: 6,
  });
  engine.gravity.y = 1.4;

  const largest = items.reduce((m, item) => Math.max(m, item.width, item.height), 40);
  const sink = largest * 0.3;
  const wall = 400;
  const spread = dropHeight + zoneHeight;
  const top = -(spread * 2 + largest * 4);
  const tall = zoneHeight + sink - top + wall;
  Matter.Composite.add(engine.world, [
    Matter.Bodies.rectangle(width / 2, zoneHeight + sink + wall / 2, width * 3, wall, {
      isStatic: true,
      friction: 0.9,
    }),
    Matter.Bodies.rectangle(-wall / 2, top + tall / 2, wall, tall, { isStatic: true }),
    Matter.Bodies.rectangle(width + wall / 2, top + tall / 2, wall, tall, { isStatic: true }),
  ]);

  const bodies = items.map((item, index) => {
    const margin = Math.max(item.width, item.height) / 2;
    const x = margin + random() * Math.max(1, width - margin * 2);
    const y =
      -dropHeight - margin - (index / Math.max(1, items.length)) * spread - random() * margin;
    const body = makeBody(item, x, y);
    Matter.Body.setAngle(body.body, (random() - 0.5) * Math.PI);
    return body;
  });
  Matter.Composite.add(
    engine.world,
    bodies.map((b) => b.body),
  );

  let elapsed = 0;
  let destroyed = false;

  const positions = (): Placement[] =>
    bodies.map(({ id, body, offsetX, offsetY }) => ({
      id,
      x: body.position.x,
      y: body.position.y,
      angle: body.angle,
      offsetX,
      offsetY,
    }));

  const isSettled = (): boolean =>
    destroyed || elapsed >= MAX_SIMULATED_MS || bodies.every(({ body }) => body.isSleeping);

  return {
    step(ms) {
      if (destroyed) return;
      let remaining = ms;
      while (remaining > 0.001) {
        const dt = Math.min(STEP_MS, remaining);
        Matter.Engine.update(engine, dt);
        elapsed += dt;
        remaining -= dt;
      }
    },
    isSettled,
    settleNow() {
      while (!isSettled()) this.step(STEP_MS);
    },
    positions,
    finalLayout() {
      const inside = new Set(
        bodies
          .filter(
            ({ body }) =>
              body.bounds.min.y >= 0 && body.bounds.min.x >= -1 && body.bounds.max.x <= width + 1,
          )
          .map(({ id }) => id),
      );
      return positions().filter((p) => inside.has(p.id));
    },
    destroy() {
      if (destroyed) return;
      destroyed = true;
      Matter.Composite.clear(engine.world, false, true);
      Matter.Engine.clear(engine);
    },
  };
}

function makeBody(
  item: PileItemSpec,
  x: number,
  y: number,
): { id: number; body: Matter.Body; offsetX: number; offsetY: number } {
  if (item.hull && item.hull.length >= 3) {
    const vertices = item.hull.map((p) => ({
      x: p.x * item.width * 0.96,
      y: p.y * item.height * 0.96,
    }));
    const centre = Matter.Vertices.centre(vertices);
    const body = Matter.Bodies.fromVertices(x, y, [vertices], BODY_OPTIONS);
    return { id: item.id, body, offsetX: -centre.x, offsetY: -centre.y };
  }
  const body = Matter.Bodies.rectangle(x, y, item.width * 0.92, item.height * 0.92, {
    ...BODY_OPTIONS,
    chamfer: { radius: Math.min(item.width, item.height) * 0.25 },
  });
  return { id: item.id, body, offsetX: 0, offsetY: 0 };
}
