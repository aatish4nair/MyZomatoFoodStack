/**
 * Sprite outline tracing, adapted from My Food Pile (MIT, Sumit Bedi): crop each picture to its
 * opaque pixels and trace a convex outline, so physics bodies collide the way the picture looks.
 */

export interface Point {
  x: number;
  y: number;
}

export interface Sprite {
  /** What to draw: the cropped picture (or the original image if cropping wasn't possible). */
  image: CanvasImageSource;
  /** Width / height of the visible picture. */
  aspect: number;
  /** Convex outline, normalised to -0.5..0.5 on both axes; null means "use a rounded box". */
  hull: Point[] | null;
}

export interface Bounds {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

/** Bounding box of pixels whose alpha exceeds `threshold`, or null for a fully transparent image. */
export function opaqueBounds(
  alpha: (index: number) => number,
  width: number,
  height: number,
  threshold = 12,
): Bounds | null {
  let x0 = width;
  let y0 = height;
  let x1 = -1;
  let y1 = -1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (alpha(y * width + x) > threshold) {
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
    }
  }
  return x1 < 0 ? null : { x0, y0, x1, y1 };
}

const cross = (o: Point, a: Point, b: Point): number =>
  (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);

/** Andrew's monotone chain convex hull. */
export function convexHull(points: readonly Point[]): Point[] {
  const sorted = [...points].sort((a, b) => a.x - b.x || a.y - b.y);
  if (sorted.length < 3) return sorted;
  const build = (input: Point[]): Point[] => {
    const out: Point[] = [];
    for (const p of input) {
      for (;;) {
        const a = out.at(-2);
        const b = out.at(-1);
        if (!a || !b || cross(a, b, p) > 0) break;
        out.pop();
      }
      out.push(p);
    }
    out.pop();
    return out;
  };
  return [...build(sorted), ...build([...sorted].reverse())];
}

/**
 * Traces the outline inside `bounds`: the left- and right-most opaque pixel of every few rows,
 * hulled and reduced to at most `maxPoints`, normalised to -0.5..0.5.
 */
export function traceOutline(
  alpha: (index: number) => number,
  width: number,
  bounds: Bounds,
  { rowStep = 4, threshold = 40, maxPoints = 16 } = {},
): Point[] {
  const points: Point[] = [];
  for (let y = bounds.y0; y <= bounds.y1; y += rowStep) {
    let left = -1;
    let right = -1;
    for (let x = bounds.x0; x <= bounds.x1; x++) {
      if (alpha(y * width + x) > threshold) {
        if (left < 0) left = x;
        right = x;
      }
    }
    if (left >= 0) points.push({ x: left, y }, { x: right, y });
  }
  let hull = convexHull(points);
  if (hull.length > maxPoints) {
    const step = hull.length / maxPoints;
    hull = Array.from({ length: maxPoints }, (_, i) => hull[Math.floor(i * step)]).filter(
      (p): p is Point => p !== undefined,
    );
  }
  const w = Math.max(1, bounds.x1 - bounds.x0);
  const h = Math.max(1, bounds.y1 - bounds.y0);
  return hull.map((p) => ({ x: (p.x - bounds.x0) / w - 0.5, y: (p.y - bounds.y0) / h - 0.5 }));
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.decoding = 'async';
    image.onload = () => {
      resolve(image);
    };
    image.onerror = () => {
      reject(new Error('Image failed to load'));
    };
    image.src = url;
  });
}

/** Loads a picture and prepares it for the pile. Falls back to a box shape if pixels can't be read. */
export async function loadSprite(url: string): Promise<Sprite> {
  const image = await loadImage(url);
  const width = image.naturalWidth;
  const height = image.naturalHeight;
  const fallback: Sprite = { image, aspect: width / Math.max(1, height) || 1, hull: null };

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return fallback;
  ctx.drawImage(image, 0, 0);
  const data = ctx.getImageData(0, 0, width, height).data;
  const alpha = (i: number): number => data[i * 4 + 3] ?? 0;

  const bounds = opaqueBounds(alpha, width, height);
  if (!bounds) return fallback;
  const cw = bounds.x1 - bounds.x0 + 1;
  const ch = bounds.y1 - bounds.y0 + 1;
  const cropped = document.createElement('canvas');
  cropped.width = cw;
  cropped.height = ch;
  cropped.getContext('2d')?.drawImage(canvas, bounds.x0, bounds.y0, cw, ch, 0, 0, cw, ch);

  const hull = traceOutline(alpha, width, bounds);
  return { image: cropped, aspect: cw / ch, hull: hull.length >= 3 ? hull : null };
}
