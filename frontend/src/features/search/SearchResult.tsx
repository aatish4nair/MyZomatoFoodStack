import type { MonthFilter, SearchOutcome, SearchSummary } from '@food-stack/shared';
import { formatLongDate, formatMonth, formatRupees, plural } from './format';
import { CalendarIcon, ClockIcon, PizzaSliceIcon } from './icons';

const monthPhrase = (month: MonthFilter): string => (month === 'all' ? 'in total' : 'this month');

/**
 * The left-hand result for a picked category or dish. It is a polite live region so screen readers
 * hear the result as text; the fade-in is only decoration.
 */
interface SearchResultProps {
  outcome: SearchOutcome;
}

export function SearchResult({ outcome }: SearchResultProps) {
  return (
    <section className="result" aria-live="polite" aria-label="Search result">
      {outcome.kind === 'match' && <MatchDetails outcome={outcome} />}
      {outcome.kind === 'none' && (
        <p className="result__empty reveal" key="none">
          No orders for “{outcome.label}”{' '}
          {outcome.month === 'all' ? 'yet' : `in ${formatMonth(outcome.month)}`}.
        </p>
      )}
    </section>
  );
}

/** How many variants a category result names before summarising the rest. */
const MAX_LISTED_VARIANTS = 6;

function MatchDetails({ outcome }: { outcome: Extract<SearchOutcome, { kind: 'match' }> }) {
  const { summary } = outcome;
  return (
    <div className="result__match reveal">
      <p className="result__count">
        <span className="visually-hidden">Orders: </span>
        <span className="result__count-number">
          <Accent side="left" />
          {summary.matchingOrderCount}
          <Accent side="right" />
        </span>
      </p>
      <h2 className="result__name">{summary.foodName}</h2>
      <Paid summary={summary} />
      <ul className="result__details">
        {summary.restaurant !== null && (
          <li>
            <PizzaSliceIcon />
            <span>
              From <strong>{summary.restaurant}</strong>.
            </span>
          </li>
        )}
        {summary.orderDate !== null && (
          <li>
            <ClockIcon />
            <span>Ordered on {formatLongDate(summary.orderDate)}.</span>
          </li>
        )}
        <li>
          <CalendarIcon />
          <span>
            Quantity: {summary.totalQuantity ?? 'not recorded'} (
            {plural(summary.matchingOrderCount, 'order')} {monthPhrase(summary.month)}).
          </span>
        </li>
      </ul>
      <Breakdown summary={summary} />
    </div>
  );
}

/**
 * The amount paid, from orders that contained only the picked category/dish. The sheet's Total
 * Paid covers a whole order and there are no item prices, so orders that also had other dishes
 * are left out of the amount and said so, rather than attributed.
 */
function Paid({ summary }: { summary: SearchSummary }) {
  if (summary.pricedOrderCount === 0) {
    return (
      <p className="result__paid result__paid--unknown">
        Amount not known
        <span className="result__note">
          {' '}
          (
          {summary.ordersWithOtherItems > 0
            ? 'always ordered with other dishes; there are no item prices'
            : 'amount missing'}
          )
        </span>
      </p>
    );
  }
  const notes = [
    summary.ordersWithOtherItems > 0 &&
      `excludes ${plural(summary.ordersWithOtherItems, 'order')} that also had other dishes`,
    summary.ordersMissingTotal > 0 &&
      `amount missing for ${plural(summary.ordersMissingTotal, 'order')}`,
  ].filter(Boolean);
  return (
    <p className="result__paid">
      {formatRupees(summary.totalPaidPaise)} <span className="result__paid-word">paid</span>
      {notes.length > 0 && <span className="result__note"> ({notes.join('; ')})</span>}
    </p>
  );
}

/** Which dishes a category result covers, or the original names a single dish was ordered as. */
function Breakdown({ summary }: { summary: SearchSummary }) {
  if (summary.selection === 'category') {
    const listed = summary.variants.slice(0, MAX_LISTED_VARIANTS);
    const more = summary.variants.length - listed.length;
    return (
      <p className="result__variants">
        Includes {listed.map((v) => `${v.name} (${plural(v.orderCount, 'order')})`).join(', ')}
        {more > 0 ? ` and ${plural(more, 'more dish', 'more dishes')}` : ''}.
      </p>
    );
  }
  const names = summary.variants.flatMap((v) => v.originalNames);
  if (names.length < 2) return null;
  return <p className="result__variants">Ordered as {names.join(', ')}.</p>;
}

/** The hand-drawn red strokes either side of the count, as in the design. */
function Accent({ side }: { side: 'left' | 'right' }) {
  return (
    <svg
      className={`result__accent result__accent--${side}`}
      viewBox="0 0 40 70"
      aria-hidden="true"
    >
      <g stroke="currentColor" strokeWidth="5" strokeLinecap="round" fill="none">
        {side === 'left' ? (
          <>
            <path d="M6 30l26 8" />
            <path d="M4 58l24-8" />
          </>
        ) : (
          <>
            <path d="M10 26l20-22" />
            <path d="M12 46l26-7" />
          </>
        )}
      </g>
    </svg>
  );
}
