import Matter from 'matter-js';
import { render, waitFor } from '@testing-library/react';
import { StrictMode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { FoodPile } from './FoodPile';
import type { Sprite } from './sprite-shape';

const sprite: Sprite = { image: document.createElement('canvas'), aspect: 1, hull: null };
const loadSprite = vi.fn(() => Promise.resolve(sprite));
const measure = () => ({ width: 800, height: 180, top: 500 });
const weights = new Map([
  ['/pizza.png', 3],
  ['/idli.png', 1],
]);

describe('FoodPile', () => {
  it('is decorative: hidden from assistive technology', () => {
    const { getByTestId } = render(
      <FoodPile
        weights={weights}
        reducedMotion
        onSettled={vi.fn()}
        loadSprite={loadSprite}
        measure={measure}
        seed={1}
      />,
    );
    expect(getByTestId('food-pile')).toHaveAttribute('aria-hidden', 'true');
  });

  it('with reduced motion, lays the pile out instantly without animation frames', async () => {
    const raf = vi.spyOn(window, 'requestAnimationFrame');
    const onSettled = vi.fn();
    render(
      <FoodPile
        weights={weights}
        reducedMotion
        onSettled={onSettled}
        loadSprite={loadSprite}
        measure={measure}
        seed={1}
      />,
    );
    await waitFor(() => {
      expect(onSettled).toHaveBeenCalledTimes(1);
    });
    expect(raf).not.toHaveBeenCalled();
  });

  it('animates with requestAnimationFrame and cleans everything up on unmount', async () => {
    const raf = vi.spyOn(window, 'requestAnimationFrame').mockImplementation(() => 7);
    const cancel = vi.spyOn(window, 'cancelAnimationFrame');
    const clear = vi.spyOn(Matter.Engine, 'clear');
    const removeListener = vi.spyOn(window, 'removeEventListener');
    const onSettled = vi.fn();
    const { unmount } = render(
      <FoodPile
        weights={weights}
        reducedMotion={false}
        onSettled={onSettled}
        loadSprite={loadSprite}
        measure={measure}
        seed={1}
      />,
    );
    await waitFor(() => {
      expect(raf).toHaveBeenCalled();
    });
    unmount();
    expect(cancel).toHaveBeenCalledWith(7);
    expect(clear).toHaveBeenCalled();
    expect(removeListener).toHaveBeenCalledWith('resize', expect.any(Function));
    expect(onSettled).not.toHaveBeenCalled();
  });

  it('runs a single drop under StrictMode double-mounting', async () => {
    const onSettled = vi.fn();
    render(
      <StrictMode>
        <FoodPile
          weights={weights}
          reducedMotion
          onSettled={onSettled}
          loadSprite={loadSprite}
          measure={measure}
          seed={1}
        />
      </StrictMode>,
    );
    await waitFor(() => {
      expect(onSettled).toHaveBeenCalled();
    });
    await new Promise((r) => setTimeout(r, 20));
    expect(onSettled).toHaveBeenCalledTimes(1);
  });

  it('settles immediately when there is no artwork to drop', async () => {
    const onSettled = vi.fn();
    render(
      <FoodPile
        weights={new Map()}
        reducedMotion={false}
        onSettled={onSettled}
        loadSprite={loadSprite}
        measure={measure}
      />,
    );
    await waitFor(() => {
      expect(onSettled).toHaveBeenCalledTimes(1);
    });
  });

  it('still settles when images fail to load', async () => {
    const onSettled = vi.fn();
    render(
      <FoodPile
        weights={weights}
        reducedMotion={false}
        onSettled={onSettled}
        loadSprite={() => Promise.reject(new Error('404'))}
        measure={measure}
      />,
    );
    await waitFor(() => {
      expect(onSettled).toHaveBeenCalledTimes(1);
    });
  });
});
