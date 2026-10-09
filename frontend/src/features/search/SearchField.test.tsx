import { act, fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SearchField } from './SearchField';

const NAMES = ['Idly', 'Masala Dosa', 'Tandoori Chicken'];

function Harness({ reducedMotion = false }: { reducedMotion?: boolean }) {
  const [value, setValue] = useState('');
  return (
    <SearchField
      value={value}
      onChange={setValue}
      suggestions={NAMES}
      reducedMotion={reducedMotion}
    />
  );
}

const placeholder = () => screen.queryByTestId('search-placeholder')?.textContent ?? null;
const tick = (ms = 1000) => {
  act(() => {
    vi.advanceTimersByTime(ms);
  });
};

describe('SearchField', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  it('has an accessible label and rotates the placeholder every second', () => {
    render(<Harness />);
    expect(screen.getByRole('searchbox', { name: 'Search your food orders' })).toBeInTheDocument();
    expect(placeholder()).toBe('Idly');
    tick();
    expect(placeholder()).toBe('Masala Dosa');
  });

  it('pauses while focused, hides while typing, and resumes only when empty and blurred', () => {
    render(<Harness />);
    const input = screen.getByRole('searchbox');

    fireEvent.focus(input);
    tick(3000);
    expect(placeholder()).toBe('Idly'); // paused while focused

    fireEvent.change(input, { target: { value: 'dos' } });
    expect(placeholder()).toBeNull(); // hidden while there is text
    tick(3000);

    fireEvent.change(input, { target: { value: '' } });
    tick(3000);
    expect(placeholder()).toBe('Idly'); // empty but still focused: still paused

    fireEvent.blur(input);
    tick();
    expect(placeholder()).toBe('Masala Dosa'); // empty and blurred: resumed
  });

  it('clears with the clear button and with Escape', () => {
    render(<Harness />);
    const input = screen.getByRole<HTMLInputElement>('searchbox');
    fireEvent.change(input, { target: { value: 'idly' } });
    fireEvent.click(screen.getByRole('button', { name: 'Clear search' }));
    expect(input.value).toBe('');
    expect(screen.queryByRole('button', { name: 'Clear search' })).toBeNull();

    fireEvent.change(input, { target: { value: 'idly' } });
    fireEvent.keyDown(input, { key: 'Escape' });
    expect(input.value).toBe('');
  });

  it('keeps a stable placeholder with reduced motion', () => {
    render(<Harness reducedMotion />);
    tick(4000);
    expect(placeholder()).toBe('Idly');
  });
});
