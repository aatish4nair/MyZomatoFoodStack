import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { setReducedMotion } from '../test/setup';
import { demoOrderSource } from '../services/demo-order-source';
import { App } from './App';
import { INTRO_FAILSAFE_MS } from './intro';

/** Makes the pile settle at once (zero-sized zone), so the interface is revealed immediately. */
const instantPile = { measure: () => ({ width: 0, height: 0, top: 0 }) };

async function renderReady() {
  const view = render(<App source={demoOrderSource} pileOverrides={instantPile} />);
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
        source={demoOrderSource}
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

  it('shows one result and its plate artwork for a match, without brackets', async () => {
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
    expect(result).toHaveTextContent('₹366 paid'); // 36604 paise, shown in whole rupees
    expect(result).toHaveTextContent('From Imaginary Tandoor.');
    expect(result).toHaveTextContent('Ordered on 28 September 2026.');
    expect(result).toHaveTextContent('Quantity: 1 (1 order this month).');
    expect(result).not.toHaveTextContent('(breast Pcs)');
    // A real tandoori image if one exists locally, otherwise the neutral plate; never the
    // fried-chicken stand-in. (Image-file-independent; App.plates.test.tsx covers the flow.)
    const images = screen.queryAllByRole('img');
    expect(images.length).toBeLessThanOrEqual(1);
    if (images[0]) {
      expect(images[0]).toHaveAccessibleName('Tandoori Chicken');
      expect(images[0].getAttribute('src')).not.toMatch(/fried-chicken/);
    } else {
      expect(screen.getByTestId('plate-placeholder')).toBeInTheDocument();
    }
    // The footer collage is untouched by the result.
    expect(screen.getByTestId('food-pile')).toBeInTheDocument();
  });

  it('updates the result when the month changes', async () => {
    await renderReady();
    search('tandoori');
    expect(screen.getByRole('region', { name: 'Search result' })).toHaveTextContent('₹373 paid'); // ₹372.50 rounds half up
    fireEvent.change(screen.getByRole('combobox', { name: 'Month' }), { target: { value: 'all' } });
    expect(screen.getByRole('region', { name: 'Search result' })).toHaveTextContent('₹739 paid'); // rounded from the exact total 73854 paise
    expect(screen.getByRole('region', { name: 'Search result' })).toHaveTextContent(
      '(2 orders in total)',
    );
  });

  it('keeps the same plate element while the user keeps typing', async () => {
    await renderReady();
    search('idl');
    const first = screen.getByRole('img', { name: 'Idly' });
    search('idly');
    expect(screen.getByRole('img', { name: 'Idly' })).toBe(first);
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

  it('shows a neutral empty plate (no picture) for a matched food without suitable artwork', async () => {
    await renderReady();
    fireEvent.change(screen.getByRole('combobox', { name: 'Month' }), {
      target: { value: '2026-09' },
    });
    search('paneer tikka');
    expect(screen.getByRole('region', { name: 'Search result' })).toHaveTextContent('Paneer Tikka');
    expect(screen.getByTestId('plate-placeholder')).toBeInTheDocument();
    expect(screen.queryByRole('img')).toBeNull();
  });

  it('asks which variant for a generic query, then shows the chosen food', async () => {
    await renderReady();
    fireEvent.change(screen.getByRole('combobox', { name: 'Month' }), { target: { value: 'all' } });
    search('momos');
    const result = screen.getByRole('region', { name: 'Search result' });
    expect(within(result).getByText('Which momos are you looking for?')).toBeInTheDocument();
    const options = within(result).getAllByRole('button');
    expect(options.map((b) => b.textContent)).toEqual([
      'Chicken Fried Momos, 1 order',
      'Steamed Veg Momos, 1 order',
    ]);
    // The question is not a result: no count, no name heading, no plate.
    expect(within(result).queryByRole('heading')).toBeNull();
    expect(screen.queryByTestId('plate-placeholder')).toBeNull();
    expect(screen.queryByRole('img')).toBeNull();

    fireEvent.click(within(result).getByRole('button', { name: /Steamed Veg Momos/ }));
    expect(screen.getByRole('searchbox')).toHaveValue('Steamed Veg Momos');
    expect(screen.getByRole('searchbox')).toHaveFocus();
    expect(within(result).getByRole('heading', { level: 2 })).toHaveTextContent(
      'Steamed Veg Momos',
    );
    expect(result).toHaveTextContent('Quantity: 2 (1 order in total).');
  });

  it('shows an exact food name directly without asking', async () => {
    await renderReady();
    fireEvent.change(screen.getByRole('combobox', { name: 'Month' }), { target: { value: 'all' } });
    search('chicken zinger burger');
    expect(screen.queryByText(/are you looking for/)).toBeNull();
    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('Chicken Zinger Burger');
  });

  it('shows the only variant directly (no question) when just one food matches', async () => {
    await renderReady();
    fireEvent.change(screen.getByRole('combobox', { name: 'Month' }), {
      target: { value: '2026-09' },
    });
    search('momos'); // September only has Steamed Veg Momos
    expect(screen.queryByText(/are you looking for/)).toBeNull();
    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('Steamed Veg Momos');
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

  it('shows a quiet error, and no demo data, when orders cannot be loaded', async () => {
    render(
      <App
        source={{ loadOrders: () => Promise.reject(new Error('offline')) }}
        pileOverrides={instantPile}
      />,
    );
    expect(await screen.findByRole('status')).toHaveTextContent(
      'Your orders couldn’t be loaded right now.',
    );
    expect(screen.getByRole('combobox', { name: 'Month' })).toHaveValue('all');
    expect(screen.queryByTestId('search-placeholder')).toBeNull();
    search('tandoori');
    expect(screen.queryByText(/Imaginary Tandoor/)).toBeNull();
    expect(screen.queryByRole('img')).toBeNull();
  });

  it('shows nothing order-related while orders are still loading', async () => {
    const { container } = render(
      <App
        source={{ loadOrders: () => new Promise(() => undefined) }}
        pileOverrides={instantPile}
      />,
    );
    await act(async () => {
      await Promise.resolve();
    });
    expect(screen.queryByTestId('search-placeholder')).toBeNull();
    expect(screen.queryByRole('status')).toBeNull();
    expect(container.querySelector('.food-pile')).toBeInTheDocument();
  });
});
