import { useRef } from 'react';
import { usePileAnimation, type PileAnimationOptions } from './usePileAnimation';

/**
 * The footer food collage. It reserves its own space at the bottom of the page, so it can never
 * cover the search or results, and it ignores the pointer so text selection and clicks pass
 * straight through. Purely decorative, so it is hidden from assistive technology.
 */
export function FoodPile(props: PileAnimationOptions) {
  const zoneRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  usePileAnimation(canvasRef, zoneRef, props);
  return (
    <div className="food-pile" ref={zoneRef} aria-hidden="true" data-testid="food-pile">
      <canvas className="food-pile__canvas" ref={canvasRef} />
    </div>
  );
}
