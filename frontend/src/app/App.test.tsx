import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { setReducedMotion } from '../test/setup';
import { App } from './App';
import { INTRO_FAILSAFE_MS } from './intro';

/** Makes the pile settle at once (zero-sized zone), so the interface is revealed immediately. */
const instantPile = { measure: () => ({ width: 0, height: 0, top: 0 }) };

async function renderReady() {
  const view = render(<App pileOverrides={instantPile} />);
  await waitFor(() => {
    expect(view.container.querySelector('.app')).toHaveClass('app--ready');
  });
  return view;
}

const search = (value: string) => {
  fireEvent.change(screen.getByRole('searchbox', { name: 'Search your food orders' }), {
    target: { value },
  });
};

describe('App', () => {
  it('renders the title with "Zomato" as the red brand word', async () => {
    await renderReady();
    expect(
      screen.getByRole('heading', { level: 1, name: 'My Zomato food Stack' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Zomato')).toHaveClass('app__brand');
  });

  it('keeps the interface hidden and inert until the food has settled', async () => {
    vi.useFakeTimers();
    // Images never load, so the pile never settles; the failsafe reveals the page.
    const { container } = render(
      <App
        pileOverrides={{
          loadSprite: () => new Promise(() => undefined),
          measure: () => ({ width: 800, height: 180, top: 400 }),
        }}
      />,
    );
    await act(async () => {
      await vi.advanceTimersByTimeAsync(100);
    });
    const main = container.querySelector('main');
    expect(main).toHaveAttribute('inert');
    expect(container.querySelector('.app')).not.toHaveClass('app--ready');
    await act(async () => {
      await vi.advanceTimersByTimeAsync(INTRO_FAILSAFE_MS);
    });
    expect(main).not.toHaveAttribute('inert');
    expect(container.querySelector('.app')).toHaveClass('app--ready');
  });

  it('shows the latest month by default and lists every month', async () => {
    await renderReady();
    const select = screen.getByRole<HTMLSelectElement>('combobox', { name: 'Month' });
    expect(select.value).toBe('2026-10');
    expect(
      within(select)
        .getAllByRole('option')
        .map((o) => o.textContent),
    ).toEqual(['October 2026', 'September 2026', 'August 2026', 'All months']);
  });

  it('shows one result and one plate for a match, without brackets in the title', async () => {
    await renderReady();
    fireEvent.change(screen.getByRole('combobox', { name: 'Month' }), {
      target: { value: '2026-09' },
    });
    search('chicken tandoori');

    const result = screen.getByRole('region', { name: 'Search result' });
    expect(within(result).getByRole('heading', { level: 2 })).toHaveTextContent(
      /^Tandoori Chicken$/,
    );
    expect(result).toHaveTextContent('Orders: 1');
    expect(result).toHaveTextContent('₹366.04 paid');
    expect(result).toHaveTextContent('From Imaginary Tandoor.');
    expect(result).toHaveTextContent('Ordered on 28 September 2026.');
    expect(result).toHaveTextContent('Quantity: 1 (1 order this month).');
    expect(result).not.toHaveTextContent('(breast Pcs)');
    expect(screen.getAllByRole('img', { name: 'Tandoori Chicken' })).toHaveLength(1);
  });

  it('updates the result when the month changes', async () => {
    await renderReady();
    search('tandoori');
    expect(screen.getByRole('region', { name: 'Search result' })).toHaveTextContent('₹372.50 paid');
    fireEvent.change(screen.getByRole('combobox', { name: 'Month' }), { target: { value: 'all' } });
    expect(screen.getByRole('region', { name: 'Search result' })).toHaveTextContent('₹738.54 paid');
    expect(screen.getByRole('region', { name: 'Search result' })).toHaveTextContent(
      '(2 orders in total)',
    );
  });

  it('keeps the same plate element while the user keeps typing', async () => {
    await renderReady();
    search('tando');
    const first = screen.getByRole('img', { name: 'Tandoori Chicken' });
    search('tandoori chi');
    expect(screen.getByRole('img', { name: 'Tandoori Chicken' })).toBe(first);
  });

  it('returns to the empty state when the search is cleared', async () => {
    await renderReady();
    search('idly');
    expect(screen.getAllByRole('img')).toHaveLength(1);
    fireEvent.click(screen.getByRole('button', { name: 'Clear search' }));
    expect(screen.queryByRole('img')).toBeNull();
    expect(screen.getByRole('region', { name: 'Search result' })).toBeEmptyDOMElement();
  });

  it('shows a restrained message and no picture when nothing matches', async () => {
    await renderReady();
    search('sushi');
    expect(screen.getByRole('region', { name: 'Search result' })).toHaveTextContent(
      'No orders for “sushi” in October 2026.',
    );
    expect(screen.queryByRole('img')).toBeNull();
  });

  it('shows no plate for a matched food that has no suitable artwork', async () => {
    await renderReady();
    fireEvent.change(screen.getByRole('combobox', { name: 'Month' }), {
      target: { value: '2026-10' },
    });
    search('garlic breadsticks'); // matches an order, but no category/artwork fits it
    expect(screen.getByRole('region', { name: 'Search result' })).toHaveTextContent(
      'Garlic Breadsticks',
    );
    expect(screen.queryByRole('img')).toBeNull();
  });

  it('rotates real food names in the placeholder, with brackets removed', async () => {
    await renderReady();
    vi.useFakeTimers();
    // Restart the rotation under fake timers (focus pauses it, blur on an empty field resumes it).
    const input = screen.getByRole('searchbox');
    fireEvent.focus(input);
    fireEvent.blur(input);
    const seen = new Set<string>();
    for (let i = 0; i < 25; i++) {
      seen.add(screen.getByTestId('search-placeholder').textContent);
      act(() => {
        vi.advanceTimersByTime(1000);
      });
    }
    expect(seen.size).toBeGreaterThan(10);
    expect(seen).toContain('Tandoori Chicken');
    expect(seen).toContain('Idly');
    for (const name of seen) expect(name).not.toMatch(/[()[\]{}]/);
  });

  it('uses a stable placeholder when reduced motion is preferred', async () => {
    setReducedMotion(true);
    await renderReady();
    vi.useFakeTimers();
    const first = screen.getByTestId('search-placeholder').textContent;
    act(() => {
      vi.advanceTimersByTime(5000);
    });
    expect(screen.getByTestId('search-placeholder').textContent).toBe(first);
  });

  it('still works with an unavailable data source', async () => {
    render(
      <App
        source={{ loadOrders: () => Promise.reject(new Error('offline')) }}
        pileOverrides={instantPile}
      />,
    );
    await waitFor(() => {
      expect(screen.getByRole('combobox', { name: 'Month' })).toHaveValue('all');
    });
    expect(screen.queryByTestId('search-placeholder')).toBeNull();
    search('idly');
    expect(screen.getByRole('region', { name: 'Search result' })).toHaveTextContent(
      'No orders for “idly” yet.',
    );
  });
});
