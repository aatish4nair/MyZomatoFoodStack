import type { Placement } from './pile-simulation';

export interface Drawable {
  image: CanvasImageSource;
  width: number;
  height: number;
}

/**
 * Sizes the canvas for the device pixel ratio and draws every item. `originY` is where the top of
 * the footer zone sits inside the canvas (non-zero while items fall from above the zone).
 * No shadows, glows or other effects: the pictures are drawn exactly as they are.
 */
export function drawPile(
  canvas: HTMLCanvasElement,
  placements: readonly Placement[],
  drawables: ReadonlyMap<number, Drawable>,
  size: { width: number; height: number; originY: number },
): void {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const pixelWidth = Math.round(size.width * dpr);
  const pixelHeight = Math.round(size.height * dpr);
  if (canvas.width !== pixelWidth) canvas.width = pixelWidth;
  if (canvas.height !== pixelHeight) canvas.height = pixelHeight;
  canvas.style.height = `${String(size.height)}px`;

  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, pixelWidth, pixelHeight);
  ctx.setTransform(dpr, 0, 0, dpr, 0, size.originY * dpr);
  for (const p of placements) {
    const item = drawables.get(p.id);
    if (!item) continue;
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(p.angle);
    ctx.drawImage(
      item.image,
      p.offsetX - item.width / 2,
      p.offsetY - item.height / 2,
      item.width,
      item.height,
    );
    ctx.restore();
  }
}
