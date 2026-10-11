import { Fragment, useId } from 'react';
import type { MonthFilter } from '@food-stack/shared';
import { formatMonth, groupMonthsByYear } from '../features/search/format';

interface MonthSelectProps {
  /** Months that have orders, as "YYYY-MM", in any order. */
  months: readonly string[];
  value: MonthFilter;
  onChange: (month: MonthFilter) => void;
}

/**
 * Native <select> styled as the design's pink pill: keyboard and screen-reader support for free.
 * "All Months" comes first; each year is an <optgroup> whose label can't be selected, and <hr>
 * dividers separate the groups (browsers without <hr> support in <select> simply omit them).
 */
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
        <option value="all">All Months</option>
        {groupMonthsByYear(months).map(({ year, months: inYear }) => (
          <Fragment key={year}>
            <hr />
            <optgroup label={year}>
              {inYear.map((month) => (
                <option key={month} value={month}>
                  {formatMonth(month)}
                </option>
              ))}
            </optgroup>
          </Fragment>
        ))}
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
