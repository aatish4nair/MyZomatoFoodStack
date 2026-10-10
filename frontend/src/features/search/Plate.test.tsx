import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Plate } from './Plate';

const FINAL = { url: '/plates/tandoori-chicken.png', placeholder: false };
const STAND_IN = { url: '/food/idli.png', placeholder: true };

describe('Plate', () => {
  it('shows final artwork (which includes its own plate) with the entrance class', () => {
    render(<Plate art={FINAL} label="Tandoori Chicken" />);
    const img = screen.getByRole('img', { name: 'Tandoori Chicken' });
    expect(img).toHaveAttribute('src', FINAL.url);
    expect(img).toHaveClass('plate__food');
    expect(screen.queryByTestId('plate-placeholder')).toBeNull();
  });

  it('places a stand-in item inside the plain plate shape', () => {
    const { container } = render(<Plate art={STAND_IN} label="Idly" />);
    expect(container.querySelector('.plate__dish img.plate__food')).toBeInTheDocument();
  });

  it('shows a neutral empty plate (no image) when no artwork exists', () => {
    render(<Plate art={null} label="Tandoori Malai Chicken" />);
    expect(screen.getByTestId('plate-placeholder')).toBeInTheDocument();
    expect(screen.queryByRole('img')).toBeNull();
  });

  it('falls back to the neutral plate if the image fails to load', () => {
    render(<Plate art={FINAL} label="Tandoori Chicken" />);
    fireEvent.error(screen.getByRole('img'));
    expect(screen.getByTestId('plate-placeholder')).toBeInTheDocument();
    expect(screen.queryByRole('img')).toBeNull();
  });

  it('keeps the same image element (no animation restart) while the dish stays the same', () => {
    const { rerender } = render(<Plate art={FINAL} label="Tandoori Chicken" />);
    const first = screen.getByRole('img');
    rerender(<Plate art={FINAL} label="Tandoori Chicken" />);
    expect(screen.getByRole('img')).toBe(first);
  });

  it('remounts the image (replaying its entrance) when the dish changes', () => {
    const { rerender } = render(<Plate art={STAND_IN} label="Idly" />);
    const first = screen.getByRole('img');
    rerender(<Plate art={{ url: '/food/dosa.png', placeholder: true }} label="Masala Dosa" />);
    expect(screen.getByRole('img')).not.toBe(first);
  });
});
