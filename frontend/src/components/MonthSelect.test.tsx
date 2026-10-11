import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { MonthSelect } from './MonthSelect';

// Unordered on purpose, with three years and a gap (no orders in 2025-02 or 2024-01).
const MONTHS = ['2025-03', '2026-10', '2024-05', '2026-02', '2025-11', '2026-09'];

describe('MonthSelect', () => {
  it('lists All Months first, then each year (latest first) with the newest month first', () => {
    render(<MonthSelect months={MONTHS} value="all" onChange={vi.fn()} />);
    const select = screen.getByRole('combobox', { name: 'Month' });
    expect(
      within(select)
        .getAllByRole('option')
        .map((o) => o.textContent),
    ).toEqual([
      'All Months',
      'October 2026',
      'September 2026',
      'February 2026',
      'November 2025',
      'March 2025',
      'May 2024',
    ]);
    expect(
      within(select)
        .getAllByRole('group')
        .map((g) => g.getAttribute('label')),
    ).toEqual(['2026', '2025', '2024']);
  });

  it('puts a divider below All Months and between years, never as an option', () => {
    render(<MonthSelect months={MONTHS} value="all" onChange={vi.fn()} />);
    const select = screen.getByRole('combobox', { name: 'Month' });
    const children = [...select.children].map((el) =>
      el.tagName === 'OPTGROUP' ? `group:${el.getAttribute('label') ?? ''}` : el.tagName,
    );
    expect(children).toEqual([
      'OPTION',
      'HR',
      'group:2026',
      'HR',
      'group:2025',
      'HR',
      'group:2024',
    ]);
    // Year labels and dividers are not selectable values.
    const values = within(select)
      .getAllByRole<HTMLOptionElement>('option')
      .map((o) => o.value);
    expect(values).not.toContain('2026');
    expect(values).toEqual([
      'all',
      '2026-10',
      '2026-09',
      '2026-02',
      '2025-11',
      '2025-03',
      '2024-05',
    ]);
  });

  it('matches the expected order for the real data: newest year and newest month first', () => {
    // The 14 months that currently have orders, deliberately shuffled.
    const real = [
      '2025-02',
      '2026-06',
      '2024-05',
      '2026-10',
      '2025-11',
      '2026-02',
      '2026-08',
      '2025-05',
      '2026-04',
      '2026-09',
      '2025-03',
      '2026-07',
      '2026-03',
      '2026-05',
    ];
    render(<MonthSelect months={real} value="all" onChange={vi.fn()} />);
    const select = screen.getByRole('combobox', { name: 'Month' });
    const groups = within(select).getAllByRole('group');
    expect(groups.map((g) => g.getAttribute('label'))).toEqual(['2026', '2025', '2024']);
    expect(
      groups.map((g) =>
        within(g)
          .getAllByRole('option')
          .map((o) => o.textContent),
      ),
    ).toEqual([
      [
        'October 2026',
        'September 2026',
        'August 2026',
        'July 2026',
        'June 2026',
        'May 2026',
        'April 2026',
        'March 2026',
        'February 2026',
      ],
      ['November 2025', 'May 2025', 'March 2025', 'February 2025'],
      ['May 2024'],
    ]);
    // Months without orders are not listed.
    for (const missing of ['January 2026', 'November 2026', 'December 2025', 'April 2025']) {
      expect(within(select).queryByRole('option', { name: missing })).toBeNull();
    }
    expect(within(select).getAllByRole('option')[0]).toHaveTextContent('All Months');
  });

  it('shows only months that have orders and reports the chosen month', () => {
    const onChange = vi.fn();
    render(<MonthSelect months={MONTHS} value="all" onChange={onChange} />);
    const select = screen.getByRole('combobox', { name: 'Month' });
    expect(within(select).queryByRole('option', { name: 'February 2025' })).toBeNull();
    fireEvent.change(select, { target: { value: '2025-11' } });
    expect(onChange).toHaveBeenCalledWith('2025-11');
    fireEvent.change(select, { target: { value: 'all' } });
    expect(onChange).toHaveBeenLastCalledWith('all');
  });

  it('shows just All Months when there are no orders', () => {
    render(<MonthSelect months={[]} value="all" onChange={vi.fn()} />);
    const select = screen.getByRole('combobox', { name: 'Month' });
    expect(
      within(select)
        .getAllByRole('option')
        .map((o) => o.textContent),
    ).toEqual(['All Months']);
    expect(select.querySelectorAll('hr')).toHaveLength(0);
  });
});
