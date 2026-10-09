import type { ArtImage } from '../food-art/registry';

/**
 * The single plated dish on the right. Final plate artwork is shown as-is. A temporary
 * placeholder (a single item, not a plated dish) is drawn on a plain plate shape so the layout
 * can be reviewed before the real artwork arrives.
 */
export function Plate({ art, label }: { art: ArtImage; label: string }) {
  return (
    <figure className="plate reveal" data-placeholder={art.placeholder || undefined}>
      {art.placeholder ? (
        <div className="plate__dish">
          <img className="plate__item" src={art.url} alt={label} draggable={false} />
        </div>
      ) : (
        <img className="plate__image" src={art.url} alt={label} draggable={false} />
      )}
    </figure>
  );
}
