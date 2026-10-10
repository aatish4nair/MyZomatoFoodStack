import { useState } from 'react';
import type { ArtImage } from '../food-art/registry';

/**
 * The single plated dish on the right. The plate itself stays still; only the food animates.
 * - Final artwork (a photo or render that already includes its plate) is shown as-is.
 * - A stand-in (a single item, not a plated dish) is placed on a plain plate shape.
 * - With no suitable artwork (`art` null), or if the image fails to load, a neutral empty plate is
 *   shown, never an unrelated dish.
 *
 * The image is keyed by dish + picture, so it plays its entrance only when the result really
 * changes, not on every keystroke while the same dish stays selected.
 */
export function Plate({ art, label }: { art: ArtImage | null; label: string }) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const usable = art && art.url !== failedUrl ? art : null;
  const foodKey = usable ? `${usable.url}|${label}` : 'empty';
  const onError = () => {
    if (usable) setFailedUrl(usable.url);
  };

  if (!usable) {
    return (
      <figure className="plate plate--empty" data-testid="plate-placeholder" aria-hidden="true">
        <div className="plate__dish" />
      </figure>
    );
  }
  if (!usable.placeholder) {
    return (
      <figure className="plate">
        <img
          key={foodKey}
          className="plate__image plate__food"
          src={usable.url}
          alt={label}
          draggable={false}
          onError={onError}
        />
      </figure>
    );
  }
  return (
    <figure className="plate" data-placeholder>
      <div className="plate__dish">
        <img
          key={foodKey}
          className="plate__item plate__food"
          src={usable.url}
          alt={label}
          draggable={false}
          onError={onError}
        />
      </div>
    </figure>
  );
}
