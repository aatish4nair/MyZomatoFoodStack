import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { PLACEHOLDER_INTERVAL_MS } from '../features/search/useRotatingPlaceholder';
import { setFinePointer, setReducedMotion } from '../test/setup';
import { demoOrderSource } from '../services/demo-order-source';
import {
  choose,
  search,
  searchbox,
  suggestion,
  suggestionList,
  suggestionNames,
} from '../test/search-helpers';
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

const pickMonth = (value: string) => {
  fireEvent.change(screen.getByRole('combobox', { name: 'Month' }), { target: { value } });
};

describe('App', () => {
  it('renders the title with "Zomato" as the red brand word', async () => {
    await renderReady();
    expect(
      screen.getByRole('heading', { level: 1, name: 'My Zomato food stack' }),
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

  it('opens on All Months, then lists the months grouped by year, newest first', async () => {
    await renderReady();
    const select = screen.getByRole<HTMLSelectElement>('combobox', { name: 'Month' });
    expect(select.value).toBe('all');
    expect(
      within(select)
        .getAllByRole('option')
        .map((o) => o.textContent),
    ).toEqual(['All Months', 'October 2026', 'September 2026', 'August 2026']);
    // The year is a group label (not a selectable option), below a divider.
    expect(within(select).getByRole('group', { name: '2026' })).toBeInTheDocument();
    expect(select.querySelectorAll('hr')).toHaveLength(1);
    // All Months shows results from every month.
    choose('tandoori', 'Tandoori Chicken');
    expect(screen.getByRole('region', { name: 'Search result' })).toHaveTextContent(
      '(2 orders in total)',
    );
  });

  it('shows one result and its plate artwork for a picked dish, without brackets', async () => {
    await renderReady();
    pickMonth('2026-09');
    choose('chicken tandoori', 'Tandoori Chicken');

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

  it('updates the picked result when the month changes', async () => {
    await renderReady();
    pickMonth('2026-10');
    choose('tandoori', 'Tandoori Chicken');
    expect(screen.getByRole('region', { name: 'Search result' })).toHaveTextContent('₹373 paid'); // ₹372.50 rounds half up
    pickMonth('all');
    expect(screen.getByRole('region', { name: 'Search result' })).toHaveTextContent('₹739 paid'); // rounded from the exact total 73854 paise
    expect(screen.getByRole('region', { name: 'Search result' })).toHaveTextContent(
      '(2 orders in total)',
    );
  });

  it('keeps the same plate element when the month changes for the same dish', async () => {
    await renderReady();
    choose('idl', 'Idly');
    const first = screen.getByRole('img', { name: 'Idly' });
    pickMonth('2026-10');
    expect(screen.getByRole('img', { name: 'Idly' })).toBe(first);
  });

  it('returns to the empty state when the search is cleared', async () => {
    await renderReady();
    choose('idly', 'Idly');
    expect(screen.getAllByRole('img')).toHaveLength(1);
    fireEvent.click(screen.getByRole('button', { name: 'Clear search' }));
    expect(screen.queryByRole('img')).toBeNull();
    expect(screen.getByRole('region', { name: 'Search result' })).toBeEmptyDOMElement();
  });

  it('shows a restrained message and no picture when nothing matches', async () => {
    await renderReady();
    pickMonth('2026-10');
    search('sushi');
    expect(suggestionList()).toBeNull();
    expect(screen.getByRole('region', { name: 'Search result' })).toHaveTextContent(
      'No orders for “sushi” in October 2026.',
    );
    expect(screen.queryByRole('img')).toBeNull();
  });

  it('shows a neutral empty plate (no picture) for a picked food without suitable artwork', async () => {
    await renderReady();
    pickMonth('2026-09');
    choose('paneer tikka', 'Paneer Tikka');
    expect(screen.getByRole('region', { name: 'Search result' })).toHaveTextContent('Paneer Tikka');
    expect(screen.getByTestId('plate-placeholder')).toBeInTheDocument();
    expect(screen.queryByRole('img')).toBeNull();
  });

  it('typing lists suggestions but never selects anything, even a single letter', async () => {
    await renderReady();
    search('c');
    expect(suggestionNames().length).toBeGreaterThan(0);
    expect(searchbox()).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('region', { name: 'Search result' })).toBeEmptyDOMElement();
    expect(screen.queryByRole('img')).toBeNull();
    expect(screen.queryByTestId('plate-placeholder')).toBeNull();
  });

  it('waits for an explicit choice even when the exact dish name is typed', async () => {
    await renderReady();
    search('chicken zinger burger');
    expect(screen.queryByRole('heading', { level: 2 })).toBeNull();
    expect(suggestionNames()).toEqual(['Chicken Zinger Burger']);
  });

  it('suggests the category first, then dishes, and picking a dish shows only that dish', async () => {
    await renderReady();
    search('momos');
    expect(suggestionNames()).toEqual([
      'Momos · All variants',
      'Chicken Fried Momos',
      'Steamed Veg Momos',
    ]);
    fireEvent.click(suggestion('Steamed Veg Momos'));
    expect(searchbox()).toHaveValue('Steamed Veg Momos');
    expect(suggestionList()).toBeNull();
    const result = screen.getByRole('region', { name: 'Search result' });
    expect(within(result).getByRole('heading', { level: 2 })).toHaveTextContent(
      'Steamed Veg Momos',
    );
    expect(result).toHaveTextContent('Quantity: 2 (1 order in total).');
  });

  it('shows every variant of a category across all months, and only the month’s otherwise', async () => {
    await renderReady();
    choose('momo', 'Momos · All variants');
    const result = screen.getByRole('region', { name: 'Search result' });
    expect(searchbox()).toHaveValue('Momos');
    expect(within(result).getByRole('heading', { level: 2 })).toHaveTextContent(
      'Momos · All variants',
    );
    expect(result).toHaveTextContent('Orders: 2');
    expect(result).toHaveTextContent('₹427 paid'); // 238 + 189, both momos-only orders
    expect(result).toHaveTextContent(
      'Includes Chicken Fried Momos (1 order), Steamed Veg Momos (1 order).',
    );
    pickMonth('2026-09');
    expect(result).toHaveTextContent('Orders: 1');
    expect(result).toHaveTextContent('Includes Steamed Veg Momos (1 order).');
    pickMonth('2026-10');
    expect(result).toHaveTextContent('No orders for “Momos” in October 2026.');
  });

  it('never attributes a whole order’s total to a dish ordered with other dishes', async () => {
    await renderReady();
    choose('pizza', 'Pizza · All variants');
    const result = screen.getByRole('region', { name: 'Search result' });
    expect(result).toHaveTextContent('Orders: 2');
    // Margherita came with Garlic Breadsticks (a side), so only the Farmhouse order is priced.
    expect(result).toHaveTextContent('₹299 paid (excludes 1 order that also had other dishes)');
    choose('margherita', 'Margherita Pizza');
    expect(result).toHaveTextContent(
      'Amount not known (always ordered with other dishes; there are no item prices)',
    );
  });

  it('supports the keyboard: arrows highlight, Enter picks the highlighted one, Escape closes', async () => {
    await renderReady();
    search('momos');
    const input = searchbox();
    // Enter with nothing highlighted does not pick anything.
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(screen.queryByRole('heading', { level: 2 })).toBeNull();

    fireEvent.keyDown(input, { key: 'ArrowDown' });
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    expect(input).toHaveAttribute('aria-activedescendant', suggestion('Chicken Fried Momos').id);
    expect(suggestion('Chicken Fried Momos')).toHaveAttribute('aria-selected', 'true');
    fireEvent.keyDown(input, { key: 'ArrowUp' });
    fireEvent.keyDown(input, { key: 'ArrowUp' }); // wraps to the last one
    expect(input).toHaveAttribute('aria-activedescendant', suggestion('Steamed Veg Momos').id);
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('Steamed Veg Momos');

    // Escape closes the list without changing the text; a second Escape clears the field.
    search('momo');
    expect(suggestionList()).not.toBeNull();
    fireEvent.keyDown(input, { key: 'Escape' });
    expect(suggestionList()).toBeNull();
    expect(input).toHaveValue('momo');
    expect(screen.queryByRole('heading', { level: 2 })).toBeNull();
    fireEvent.keyDown(input, { key: 'Escape' });
    expect(input).toHaveValue('');
  });

  it('closes the suggestions when clicking elsewhere, without selecting', async () => {
    await renderReady();
    search('momos');
    fireEvent.pointerDown(screen.getByRole('heading', { level: 1 }));
    expect(suggestionList()).toBeNull();
    expect(searchbox()).toHaveValue('momos');
    expect(screen.getByRole('region', { name: 'Search result' })).toBeEmptyDOMElement();
  });

  it('keeps the month menu independent: suggestions follow the selected month', async () => {
    await renderReady();
    pickMonth('2026-09');
    search('momos');
    expect(suggestionNames()).toEqual(['Momos · All variants', 'Steamed Veg Momos']);
    pickMonth('all');
    expect(suggestionNames()).toContain('Chicken Fried Momos');
  });

  it('rotates real food names in the placeholder, with brackets removed', async () => {
    await renderReady();
    vi.useFakeTimers();
    // Restart the rotation under fake timers (typing pauses it, clearing the field resumes it).
    search('x');
    search('');
    const seen = new Set<string>();
    for (let i = 0; i < 25; i++) {
      seen.add(screen.getByTestId('search-placeholder').textContent);
      act(() => {
        vi.advanceTimersByTime(PLACEHOLDER_INTERVAL_MS);
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

describe('keeping the search field ready for typing', () => {
  const monthSelect = () => screen.getByRole('combobox', { name: 'Month' });

  it('focuses the search field when the page is revealed (mouse/trackpad devices)', async () => {
    setFinePointer(true);
    await renderReady();
    // Focus is set in an effect right after the reveal; wait for it rather than racing it.
    await waitFor(() => {
      expect(searchbox()).toHaveFocus();
    });
  });

  it('puts the focus back after a click on a non-interactive area', async () => {
    setFinePointer(true);
    await renderReady();
    monthSelect().focus();
    fireEvent.click(screen.getByRole('heading', { level: 1 }));
    expect(searchbox()).toHaveFocus();
    monthSelect().focus();
    fireEvent.click(document.body);
    expect(searchbox()).toHaveFocus();
  });

  it('does not take the focus from a control that is clicked', async () => {
    setFinePointer(true);
    await renderReady();
    monthSelect().focus();
    fireEvent.click(monthSelect());
    expect(monthSelect()).toHaveFocus();
  });

  it('returns to the field after a month is picked with the mouse', async () => {
    setFinePointer(true);
    await renderReady();
    monthSelect().focus();
    fireEvent.pointerDown(monthSelect());
    pickMonth('2026-09');
    expect(monthSelect()).toHaveValue('2026-09');
    expect(searchbox()).toHaveFocus();
  });

  it('leaves the focus on the month menu while it is used with the keyboard', async () => {
    setFinePointer(true);
    await renderReady();
    monthSelect().focus();
    fireEvent.keyDown(monthSelect(), { key: 'ArrowDown' });
    pickMonth('2026-08');
    expect(monthSelect()).toHaveValue('2026-08');
    expect(monthSelect()).toHaveFocus();
  });

  it('does not refocus when the click selected some text', async () => {
    setFinePointer(true);
    await renderReady();
    monthSelect().focus();
    vi.spyOn(window, 'getSelection').mockReturnValue({ isCollapsed: false } as Selection);
    fireEvent.click(screen.getByRole('heading', { level: 1 }));
    expect(monthSelect()).toHaveFocus();
  });

  it('keeps the focus in the field when a suggestion or the clear button is used', async () => {
    setFinePointer(true);
    await renderReady();
    searchbox().focus();
    choose('momos', 'Steamed Veg Momos');
    expect(searchbox()).toHaveFocus();
    const clear = screen.getByRole('button', { name: 'Clear search' });
    clear.focus();
    fireEvent.click(clear);
    expect(searchbox()).toHaveValue('');
    expect(searchbox()).toHaveFocus();
  });

  it('never moves the focus by itself on touch devices (no surprise keyboard)', async () => {
    await renderReady();
    expect(searchbox()).not.toHaveFocus();
    fireEvent.click(screen.getByRole('heading', { level: 1 }));
    expect(searchbox()).not.toHaveFocus();
  });

  it('removes its listeners when the page unmounts', async () => {
    setFinePointer(true);
    const removed = vi.spyOn(document, 'removeEventListener');
    const view = await renderReady();
    view.unmount();
    const types = removed.mock.calls.map(([type]) => type);
    for (const type of ['pointerdown', 'keydown', 'click', 'change']) expect(types).toContain(type);
  });
});
