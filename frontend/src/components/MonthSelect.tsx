import { useId } from 'react';
import type { MonthFilter } from '@food-stack/shared';
import { formatMonth } from '../features/search/format';

interface MonthSelectProps {
  months: readonly string[];
  value: MonthFilter;
  onChange: (month: MonthFilter) => void;
}

/** Native <select> styled as the design's pink pill: keyboard and screen-reader support for free. */
export function MonthSelect({ months, value, onChange }: MonthSelectProps) {
  const id = useId();
  return (
    <div className="month">
      <label className="visually-hidden" htmlFor={id}>
        Month
      </label>
      <select
        id={id}
        className="month__select"
        value={value}
        onChange={(event) => {
          onChange(event.target.value);
        }}
      >
        {months.map((month) => (
          <option key={month} value={month}>
            {formatMonth(month)}
          </option>
        ))}
        <option value="all">All months</option>
      </select>
      <svg className="month__chevron" viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
        <path
          d="M6 9l6 6 6-6"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  );
}
