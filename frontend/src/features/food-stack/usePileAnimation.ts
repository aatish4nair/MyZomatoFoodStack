import { useEffect, useRef, type RefObject } from 'react';
import { drawPile, type Drawable } from './pile-renderer';
import { choosePileItems, computePileLayout, seededRandom } from './pile-layout';
import {
  createPileSimulation,
  STEP_MS,
  type PileItemSpec,
  type PileSimulation,
  type Placement,
} from './pile-simulation';
import { loadSprite as defaultLoadSprite, type Sprite } from './sprite-shape';

export interface ZoneSize {
  width: number;
  height: number;
  /** Distance from the viewport top to the zone top (how far items fall before reaching it). */
  top: number;
}

export interface PileAnimationOptions {
  /** Image URL → weight (how often that food appears). Empty means no pile. */
  weights: ReadonlyMap<string, number>;
  reducedMotion: boolean;
  /** Called once, when the opening drop has finished (or was skipped). */
  onSettled: () => void;
  loadSprite?: (url: string) => Promise<Sprite>;
  measure?: (zone: HTMLElement) => ZoneSize;
  seed?: number;
}

const SPRITE_TIMEOUT_MS = 2500;
const RESIZE_DEBOUNCE_MS = 200;

const measureZone = (zone: HTMLElement): ZoneSize => {
  const rect = zone.getBoundingClientRect();
  return { width: zone.clientWidth, height: zone.clientHeight, top: Math.max(0, rect.top) };
};

/**
 * Runs the opening food fall once, then freezes the result as a static drawing: no physics or
 * animation frames run after the pile settles. Reduced motion, a hidden tab, or a resize settle
 * the pile instantly instead. Every frame, timer, listener and physics body is released on unmount
 * (including React StrictMode's development double-mount).
 */
export function usePileAnimation(
  canvasRef: RefObject<HTMLCanvasElement | null>,
  zoneRef: RefObject<HTMLElement | null>,
  options: PileAnimationOptions,
): void {
  const { weights, reducedMotion, seed } = options;
  const loadSprite = options.loadSprite ?? defaultLoadSprite;
  const measure = options.measure ?? measureZone;
  const onSettledRef = useRef(options.onSettled);
  useEffect(() => {
    onSettledRef.current = options.onSettled;
  });
  const weightsKey = [...weights].map(([url, w]) => `${url}=${String(w)}`).join('|');

  useEffect(() => {
    const canvas = canvasRef.current;
    const zone = zoneRef.current;
    if (!canvas || !zone) return;

    let disposed = false;
    let frame = 0;
    let resizeTimer: ReturnType<typeof setTimeout> | undefined;
    let simulation: PileSimulation | null = null;
    let settledOnce = false;
    let sprites = new Map<string, Sprite>();
    let finishIfHidden = (): void => undefined;
    let lastSize: ZoneSize = measure(zone);
    const random = seededRandom(seed ?? Date.now());

    const announceSettled = (): void => {
      if (settledOnce || disposed) return;
      settledOnce = true;
      onSettledRef.current();
    };

    const buildItems = (
      size: ZoneSize,
    ): { specs: PileItemSpec[]; drawables: Map<number, Drawable> } => {
      const layout = computePileLayout(size.width, size.height);
      const available = new Map([...weights].filter(([url]) => sprites.has(url)));
      const urls = choosePileItems(available, layout.itemCount, random);
      const specs: PileItemSpec[] = [];
      const drawables = new Map<number, Drawable>();
      urls.forEach((url, id) => {
        const sprite = sprites.get(url);
        if (!sprite) return;
        const long = layout.itemSize * (0.85 + random() * 0.3);
        const width = sprite.aspect >= 1 ? long : long * sprite.aspect;
        const height = sprite.aspect >= 1 ? long / sprite.aspect : long;
        specs.push({ id, width, height, hull: sprite.hull });
        drawables.set(id, { image: sprite.image, width, height });
      });
      return { specs, drawables };
    };

    const freeze = (
      sim: PileSimulation,
      drawables: Map<number, Drawable>,
      size: ZoneSize,
    ): void => {
      const layout: Placement[] = sim.finalLayout();
      sim.destroy();
      if (simulation === sim) simulation = null;
      drawPile(canvas, layout, drawables, { width: size.width, height: size.height, originY: 0 });
      announceSettled();
    };

    /** Lays the pile out without animation (reduced motion, hidden tab, resize). */
    const settleInstantly = (size: ZoneSize): void => {
      const { specs, drawables } = buildItems(size);
      const sim = createPileSimulation({
        width: size.width,
        zoneHeight: size.height,
        dropHeight: 0,
        items: specs,
        random,
      });
      sim.settleNow();
      freeze(sim, drawables, size);
    };

    const animate = (size: ZoneSize): void => {
      const { specs, drawables } = buildItems(size);
      const sim = createPileSimulation({
        width: size.width,
        zoneHeight: size.height,
        dropHeight: size.top,
        items: specs,
        random,
      });
      simulation = sim;
      const canvasSize = { width: size.width, height: size.height + size.top, originY: size.top };
      let last = performance.now();
      let carry = 0;
      const tick = (now: number): void => {
        if (disposed || simulation !== sim) return;
        carry += Math.min(50, now - last);
        last = now;
        const steps = Math.floor(carry / STEP_MS);
        if (steps > 0) {
          sim.step(steps * STEP_MS);
          carry -= steps * STEP_MS;
        }
        if (sim.isSettled()) {
          freeze(sim, drawables, size);
          return;
        }
        drawPile(canvas, sim.positions(), drawables, canvasSize);
        frame = requestAnimationFrame(tick);
      };
      frame = requestAnimationFrame(tick);

      // Finish instantly if the tab is hidden mid-drop instead of simulating in the background.
      finishIfHidden = () => {
        if (document.hidden && simulation === sim) {
          cancelAnimationFrame(frame);
          sim.settleNow();
          freeze(sim, drawables, size);
        }
      };
    };

    const onVisibilityChange = (): void => {
      finishIfHidden();
    };

    const onResize = (): void => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        const size = measure(zone);
        if (size.width === lastSize.width && size.height === lastSize.height) return;
        lastSize = size;
        cancelAnimationFrame(frame);
        simulation?.destroy();
        simulation = null;
        settleInstantly(size);
      }, RESIZE_DEBOUNCE_MS);
    };

    const start = async (): Promise<void> => {
      const urls = [...weights.keys()];
      if (urls.length === 0 || lastSize.width <= 0 || lastSize.height <= 0) {
        announceSettled(); // nothing to drop or nowhere to drop it
        return;
      }
      const loaded: (readonly [string, Sprite] | null)[] = await Promise.race([
        Promise.all(
          urls.map((url) =>
            loadSprite(url).then(
              (s) => [url, s] as const,
              () => null,
            ),
          ),
        ),
        new Promise<null[]>((resolve) =>
          setTimeout(() => {
            resolve([]);
          }, SPRITE_TIMEOUT_MS),
        ),
      ]);
      if (disposed) return;
      sprites = new Map(
        loaded.filter((entry): entry is readonly [string, Sprite] => entry !== null),
      );
      const size = measure(zone);
      lastSize = size;
      if (sprites.size === 0 || size.width <= 0 || size.height <= 0) {
        announceSettled();
        return;
      }
      if (reducedMotion || document.hidden) settleInstantly(size);
      else animate(size);
    };

    void start();
    window.addEventListener('resize', onResize);
    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      disposed = true;
      cancelAnimationFrame(frame);
      clearTimeout(resizeTimer);
      window.removeEventListener('resize', onResize);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      simulation?.destroy();
      simulation = null;
    };
    // weightsKey stands in for `weights` (a new Map each render would restart the drop).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canvasRef, zoneRef, weightsKey, reducedMotion, seed]);
}
