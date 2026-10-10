import type { MonthFilter, SearchOutcome } from '@food-stack/shared';
import { formatLongDate, formatMonth, formatRupees, plural } from './format';
import { CalendarIcon, ClockIcon, PizzaSliceIcon } from './icons';

const monthPhrase = (month: MonthFilter): string => (month === 'all' ? 'in total' : 'this month');

/**
 * The left-hand result. It is a polite live region so screen readers hear the result as text;
 * the fade-in is only decoration. The panel fades in when a result first appears and then
 * updates in place while the user keeps typing (no restart on every keystroke).
 */
interface SearchResultProps {
  outcome: SearchOutcome;
  /** Called with a food's display name when the user picks one of the suggested variants. */
  onSelectVariant: (name: string) => void;
}

export function SearchResult({ outcome, onSelectVariant }: SearchResultProps) {
  return (
    <section className="result" aria-live="polite" aria-label="Search result">
      {outcome.kind === 'match' && <MatchDetails outcome={outcome} />}
      {outcome.kind === 'clarify' && <Clarify outcome={outcome} onSelect={onSelectVariant} />}
      {outcome.kind === 'none' && (
        <p className="result__empty reveal" key="none">
          No orders for “{outcome.query}”{' '}
          {outcome.month === 'all' ? 'yet' : `in ${formatMonth(outcome.month)}`}.
        </p>
      )}
    </section>
  );
}

/**
 * "Which biryani are you looking for?" followed by the real variants as buttons: reachable with Tab,
 * activated with Enter/Space, and large enough to tap on mobile. It never shows a result or a plate
 * itself, so the question is clearly separate from an actual result.
 */
function Clarify({
  outcome,
  onSelect,
}: {
  outcome: Extract<SearchOutcome, { kind: 'clarify' }>;
  onSelect: (name: string) => void;
}) {
  const question = `Which ${outcome.query.toLowerCase()} are you looking for?`;
  return (
    <div className="clarify reveal" key="clarify">
      <p className="clarify__question" id="clarify-question">
        {question}
      </p>
      <ul className="clarify__options" aria-labelledby="clarify-question">
        {outcome.options.map((option) => (
          <li key={option.name}>
            <button
              type="button"
              className="clarify__option"
              onClick={() => {
                onSelect(option.name);
              }}
            >
              {option.name}
              <span className="visually-hidden">, {plural(option.orderCount, 'order')}</span>
            </button>
          </li>
        ))}
      </ul>
      {outcome.moreCount > 0 && (
        <p className="clarify__more">
          {plural(outcome.moreCount, 'more match')}. Keep typing to narrow it down.
        </p>
      )}
    </div>
  );
}

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
      <p className="result__paid">
        {formatRupees(summary.totalPaidPaise)} <span className="result__paid-word">paid</span>
        {summary.ordersMissingTotal > 0 && (
          <span className="result__note">
            {' '}
            (amount missing for {plural(summary.ordersMissingTotal, 'order')})
          </span>
        )}
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
            Quantity: {summary.totalQuantity ?? 'not recorded'} (
            {plural(summary.matchingOrderCount, 'order')} {monthPhrase(summary.month)}).
          </span>
        </li>
      </ul>
    </div>
  );
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
