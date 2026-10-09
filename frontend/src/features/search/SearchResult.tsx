import type { MonthFilter, SearchOutcome } from '@food-stack/shared';
import { formatLongDate, formatMonth, formatRupees, plural } from './format';
import { CalendarIcon, ClockIcon, PizzaSliceIcon } from './icons';

const monthPhrase = (month: MonthFilter): string => (month === 'all' ? 'in total' : 'this month');

/**
 * The left-hand result. It is a polite live region so screen readers hear the result as text;
 * the fade-in is only decoration. The panel fades in when a result first appears and then
 * updates in place while the user keeps typing (no restart on every keystroke).
 */
export function SearchResult({ outcome }: { outcome: SearchOutcome }) {
  return (
    <section className="result" aria-live="polite" aria-label="Search result">
      {outcome.kind === 'match' && <MatchDetails outcome={outcome} />}
      {outcome.kind === 'none' && (
        <p className="result__empty reveal" key="none">
          No orders for “{outcome.query}”{' '}
          {outcome.month === 'all' ? 'yet' : `in ${formatMonth(outcome.month)}`}.
        </p>
      )}
    </section>
  );
}

function MatchDetails({ outcome }: { outcome: Extract<SearchOutcome, { kind: 'match' }> }) {
  const { summary } = outcome;
  return (
    <div className="result__match reveal">
      <p className="result__count">
        <span className="visually-hidden">Orders: </span>
        <Accent />
        <span className="result__count-number">{summary.matchingOrderCount}</span>
      </p>
      <h2 className="result__name">{summary.foodName}</h2>
      <p className="result__paid">
        {formatRupees(summary.totalPaid)} <span className="result__paid-word">paid</span>
      </p>
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
            Quantity: {summary.totalQuantity} ({plural(summary.matchingOrderCount, 'order')}{' '}
            {monthPhrase(summary.month)}).
          </span>
        </li>
      </ul>
    </div>
  );
}

/** The hand-drawn red strokes either side of the count, as in the design. */
function Accent() {
  return (
    <svg className="result__accent" viewBox="0 0 200 120" aria-hidden="true">
      <g stroke="currentColor" strokeWidth="5" strokeLinecap="round" fill="none">
        <path d="M14 58l20 6" />
        <path d="M10 82l18-6" />
        <path d="M150 40l14-16" />
        <path d="M156 64l22-6" />
      </g>
    </svg>
  );
}
