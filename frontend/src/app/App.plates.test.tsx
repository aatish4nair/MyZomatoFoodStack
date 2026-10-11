import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { ArtImage } from '../features/food-art/registry';
import { demoOrderSource } from '../services/demo-order-source';
import { choose, search } from '../test/search-helpers';
import { App } from './App';

/** Deterministic plate images for the demo dishes, independent of the files on disk. */
vi.mock('../features/food-art/registry', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../features/food-art/registry')>();
  const dishes: Record<string, string> = {
    'Tandoori Chicken': '/plates/Tandoori Chicken.png',
    Idly: '/plates/Idly.png',
    'Margherita Pizza': '/plates/Margherita Pizza.png',
  };
  return {
    ...actual,
    dishPlateArt: (name: string): ArtImage | null =>
      dishes[name] ? { url: dishes[name], placeholder: false } : null,
  };
});

const instantPile = { measure: () => ({ width: 0, height: 0, top: 0 }) };
const month = (value: string) => {
  fireEvent.change(screen.getByRole('combobox', { name: 'Month' }), { target: { value } });
};

async function renderReady() {
  const view = render(<App source={demoOrderSource} pileOverrides={instantPile} />);
  await waitFor(() => {
    expect(view.container.querySelector('.app')).toHaveClass('app--ready');
  });
  return view;
}

describe('plate images on the right', () => {
  it('shows the dish’s own image when a cleaned dish name is picked', async () => {
    await renderReady();
    choose('tandoori chicken', 'Tandoori Chicken');
    const img = screen.getByRole('img', { name: 'Tandoori Chicken' });
    expect(img).toHaveAttribute('src', '/plates/Tandoori Chicken.png');
    expect(img).toHaveClass('plate__image', 'plate__food');
  });

  it('changes the image when the searched dish changes', async () => {
    await renderReady();
    choose('idly', 'Idly');
    expect(screen.getByRole('img')).toHaveAttribute('src', '/plates/Idly.png');
    choose('margherita pizza', 'Margherita Pizza');
    expect(screen.getByRole('img')).toHaveAttribute('src', '/plates/Margherita Pizza.png');
  });

  it('reuses one image for a dish with several orders', async () => {
    await renderReady();
    month('all');
    choose('idly', 'Idly'); // two Idly orders in the demo data
    expect(screen.getByRole('region', { name: 'Search result' })).toHaveTextContent(
      '(2 orders in total)',
    );
    expect(screen.getAllByRole('img')).toHaveLength(1);
  });

  it('falls back to the art rules, then the neutral plate, when a dish has no image of its own', async () => {
    await renderReady();
    month('2026-09');
    choose('paneer tikka', 'Paneer Tikka'); // no own image, no suitable stand-in
    expect(screen.getByTestId('plate-placeholder')).toBeInTheDocument();
    expect(screen.queryByRole('img')).toBeNull();
  });

  it('clears back to the empty right side, and shows no image for an unmatched search', async () => {
    await renderReady();
    choose('tandoori chicken', 'Tandoori Chicken');
    expect(screen.getByRole('img')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Clear search' }));
    expect(screen.queryByRole('img')).toBeNull();
    expect(screen.queryByTestId('plate-placeholder')).toBeNull();
    search('sushi');
    expect(screen.queryByRole('img')).toBeNull();
    expect(screen.queryByTestId('plate-placeholder')).toBeNull();
  });

  it('shows no picture while the user is only typing', async () => {
    await renderReady();
    search('tandoori chicken');
    expect(screen.queryByRole('img')).toBeNull();
    expect(screen.queryByTestId('plate-placeholder')).toBeNull();
  });

  it('shows the most-ordered dish’s image for a category', async () => {
    await renderReady();
    choose('idl', 'Idli · All variants');
    expect(screen.getByRole('img')).toHaveAttribute('src', '/plates/Idly.png');
  });
});
