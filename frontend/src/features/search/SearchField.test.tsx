import { act, fireEvent, render, screen, within } from '@testing-library/react';
import type { Suggestion } from '@food-stack/shared';
import { useState } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SearchField } from './SearchField';
import { PLACEHOLDER_INTERVAL_MS } from './useRotatingPlaceholder';

const NAMES = ['Idly', 'Masala Dosa', 'Tandoori Chicken'];

const OPTIONS: Suggestion[] = [
  {
    kind: 'category',
    category: 'Momos',
    label: 'Momos · All variants',
    dishCount: 2,
    orderCount: 3,
  },
  {
    kind: 'dish',
    key: 'momos steamed veg',
    name: 'Steamed Veg Momos',
    category: 'Momos',
    orderCount: 2,
  },
];

function Harness({
  reducedMotion = false,
  onSelect = vi.fn(),
}: {
  reducedMotion?: boolean;
  onSelect?: (s: Suggestion) => void;
}) {
  const [value, setValue] = useState('');
  return (
    <SearchField
      value={value}
      onChange={setValue}
      options={value.trim() ? OPTIONS : []}
      onSelect={onSelect}
      placeholderNames={NAMES}
      reducedMotion={reducedMotion}
    />
  );
}

const field = () =>
  screen.getByRole<HTMLInputElement>('combobox', { name: 'Search your food orders' });

const placeholder = () => screen.queryByTestId('search-placeholder')?.textContent ?? null;
const tick = (ms = PLACEHOLDER_INTERVAL_MS) => {
  act(() => {
    vi.advanceTimersByTime(ms);
  });
};

describe('SearchField', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  it('has an accessible label and rotates the placeholder at a calm, steady pace', () => {
    render(<Harness />);
    expect(field()).toBeInTheDocument();
    expect(placeholder()).toBe('Idly');
    tick();
    expect(placeholder()).toBe('Masala Dosa');
  });

  it('keeps rotating while focused, pauses while typing, and resumes once cleared', () => {
    render(<Harness />);
    const input = field();

    input.focus();
    tick();
    expect(placeholder()).toBe('Masala Dosa'); // focused but empty: still rotating

    fireEvent.change(input, { target: { value: 'dos' } });
    expect(placeholder()).toBeNull(); // hidden while there is text
    tick(PLACEHOLDER_INTERVAL_MS * 3);
    expect(input.value).toBe('dos'); // the user's text is never touched

    fireEvent.change(input, { target: { value: '' } });
    expect(placeholder()).toBe('Masala Dosa'); // back at once, where it paused
    tick(PLACEHOLDER_INTERVAL_MS - 1);
    expect(placeholder()).toBe('Masala Dosa'); // shown for the full interval again
    tick(1);
    expect(placeholder()).toBe('Tandoori Chicken');
    expect(input).toHaveFocus();
  });

  it('clears with the clear button and with Escape', () => {
    render(<Harness />);
    const input = field();
    fireEvent.change(input, { target: { value: 'idly' } });
    fireEvent.click(screen.getByRole('button', { name: 'Clear search' }));
    expect(input.value).toBe('');
    expect(screen.queryByRole('button', { name: 'Clear search' })).toBeNull();

    fireEvent.change(input, { target: { value: 'idly' } });
    fireEvent.keyDown(input, { key: 'Escape' }); // first Escape closes the suggestions
    expect(input.value).toBe('idly');
    fireEvent.keyDown(input, { key: 'Escape' });
    expect(input.value).toBe('');
  });

  it('keeps a stable placeholder with reduced motion', () => {
    render(<Harness reducedMotion />);
    tick(4000);
    expect(placeholder()).toBe('Idly');
  });

  it('lists suggestions while typing without selecting one', () => {
    const onSelect = vi.fn();
    render(<Harness onSelect={onSelect} />);
    fireEvent.change(field(), { target: { value: 'm' } });
    const list = screen.getByRole('listbox', { name: 'Suggestions' });
    expect(within(list).getAllByRole('option')).toHaveLength(2);
    expect(field()).toHaveAttribute('aria-expanded', 'true');
    expect(field()).not.toHaveAttribute('aria-activedescendant');
    fireEvent.keyDown(field(), { key: 'Enter' }); // nothing highlighted: nothing picked
    expect(onSelect).not.toHaveBeenCalled();
  });

  it('picks the highlighted suggestion with Enter, and a clicked or tapped one', () => {
    const onSelect = vi.fn();
    render(<Harness onSelect={onSelect} />);
    fireEvent.change(field(), { target: { value: 'momos' } });
    fireEvent.keyDown(field(), { key: 'ArrowDown' });
    fireEvent.keyDown(field(), { key: 'ArrowDown' });
    fireEvent.keyDown(field(), { key: 'Enter' });
    expect(onSelect).toHaveBeenLastCalledWith(OPTIONS[1]);
    expect(screen.queryByRole('listbox', { name: 'Suggestions' })).toBeNull();

    fireEvent.change(field(), { target: { value: 'momo' } });
    const category = screen.getByRole('option', { name: /Momos · All variants/ });
    expect(fireEvent.mouseDown(category)).toBe(false); // focus stays in the field
    fireEvent.click(category);
    expect(onSelect).toHaveBeenLastCalledWith(OPTIONS[0]);
  });

  it('highlights a suggestion under the mouse pointer', () => {
    render(<Harness />);
    fireEvent.change(field(), { target: { value: 'momos' } });
    const dish = screen.getByRole('option', { name: /Steamed Veg Momos/ });
    fireEvent.mouseMove(dish);
    expect(dish).toHaveAttribute('aria-selected', 'true');
    expect(field()).toHaveAttribute('aria-activedescendant', dish.id);
  });

  it('shows counts with each suggestion', () => {
    render(<Harness />);
    fireEvent.change(field(), { target: { value: 'momos' } });
    expect(screen.getByRole('option', { name: /Momos · All variants/ })).toHaveTextContent(
      '2 dishes · 3 orders',
    );
    expect(screen.getByRole('option', { name: /Steamed Veg Momos/ })).toHaveTextContent('2 orders');
  });
});
