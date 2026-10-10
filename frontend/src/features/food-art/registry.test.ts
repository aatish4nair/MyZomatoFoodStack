import { categorize } from '@food-stack/shared';
import { describe, expect, it } from 'vitest';
import { buildDishPlateIndex, dishPlateArt, pileArt, plateArt } from './registry';

const plateFor = (name: string) => {
  const category = categorize(name);
  return category ? plateArt(category) : null;
};

describe('food art mapping', () => {
  it('never shows the fried-chicken drumstick for tandoori or Afghani chicken', () => {
    for (const name of ['Tandoori Chicken (breast Pcs)', 'Chicken Tandoori', 'Afghani Chicken']) {
      expect(plateFor(name)?.url ?? '').not.toMatch(/fried-chicken/);
    }
  });

  it('uses the fried-chicken stand-in only for fried chicken', () => {
    expect(plateFor('Crispy Fried Chicken Wings')?.url).toMatch(/fried-chicken/);
  });

  it('shows the biryani stand-in (chicken on top) only for chicken biryani', () => {
    expect(plateFor('Chicken Dum Biryani')?.url).toMatch(/biryani/);
    expect(plateFor('Veg Biryani')).toBeNull();
    expect(plateFor('Mutton Biryani')).toBeNull();
  });

  it('shows idli as idli and dosa as dosa', () => {
    expect(plateFor('Idly [2 Ps]')?.url).toMatch(/idli/);
    expect(plateFor('Masala Dosa')?.url).toMatch(/dosa/);
  });

  it('marks every current image as a temporary stand-in and never uses the steaming chai', () => {
    for (const category of ['pizza', 'idli', 'cold-drink'] as const) {
      expect(pileArt(category)?.placeholder).toBe(true);
    }
    expect(plateFor('Masala Chai')).toBeNull();
  });

  it('keeps Tandoori Malai Chicken in the creamy family: no picture until that art exists', () => {
    expect(categorize('Tandoori Malai Chicken')).toBe('afghani-chicken');
    expect(plateFor('Tandoori Malai Chicken')).toBeNull();
    expect(plateFor('Afghani Chicken')).toBeNull();
  });
});

describe('per-dish plate images (files named after dishes)', () => {
  const index = buildDishPlateIndex({
    '../../assets/plates/Chicken Hyderabadi Dum Biryani.png': '/a.png',
    '../../assets/plates/Tender Coconut Ice Cream 500ml.png': '/b.png',
    '../../assets/plates/Hot and Crispy Chicken.png': '/c.png',
    '../../assets/plates/chicken-tandoori.png': '/d.png',
    '../../assets/plates/Butter Naan.png': '/e.png',
  });

  it('matches a cleaned display name to the file named after that dish', () => {
    expect(dishPlateArt('Chicken Hyderabadi Dum Biryani', index)).toEqual({
      url: '/a.png',
      placeholder: false,
    });
    expect(dishPlateArt('Butter Naan', index)?.url).toBe('/e.png');
  });

  it('ignores case, punctuation, "&" vs "and", word order and pack-size words in filenames', () => {
    expect(dishPlateArt('Tender Coconut Ice Cream', index)?.url).toBe('/b.png');
    expect(dishPlateArt('Hot & Crispy Chicken', index)?.url).toBe('/c.png');
    expect(dishPlateArt('Tandoori Chicken', index)?.url).toBe('/d.png');
    expect(dishPlateArt('chicken hyderabadi dum biryani', index)?.url).toBe('/a.png');
  });

  it('accepts JPEG, WebP and AVIF files as well as PNG', () => {
    const mixed = buildDishPlateIndex({
      'x/Butter Naan.jpg': '/naan.jpg',
      'x/Masala Dosa.JPEG': '/dosa.jpeg',
      'x/Mango Lassi.webp': '/lassi.webp',
      'x/Gulab Jamun.avif': '/jamun.avif',
    });
    expect(dishPlateArt('Butter Naan', mixed)?.url).toBe('/naan.jpg');
    expect(dishPlateArt('Masala Dosa', mixed)?.url).toBe('/dosa.jpeg');
    expect(dishPlateArt('Mango Lassi', mixed)?.url).toBe('/lassi.webp');
    expect(dishPlateArt('Gulab Jamun', mixed)?.url).toBe('/jamun.avif');
  });

  it('never guesses: a different or partial dish name gets no image', () => {
    expect(dishPlateArt('Mutton Hyderabadi Dum Biryani', index)).toBeNull();
    expect(dishPlateArt('Chicken Biryani', index)).toBeNull();
    expect(dishPlateArt('Garlic Naan', index)).toBeNull();
  });

  it('reuses another dish’s image through an alias, but prefers the dish’s own image', () => {
    const aliases = { 'Chicken Biryani With Raita Combo': 'Chicken Hyderabadi Dum Biryani' };
    expect(dishPlateArt('Chicken Biryani With Raita Combo', index, aliases)?.url).toBe('/a.png');
    expect(dishPlateArt('chicken biryani with raita combo', index, aliases)?.url).toBe('/a.png');
    const own = buildDishPlateIndex({
      'x/Chicken Biryani With Raita Combo.png': '/own.png',
      'x/Chicken Hyderabadi Dum Biryani.png': '/a.png',
    });
    expect(dishPlateArt('Chicken Biryani With Raita Combo', own, aliases)?.url).toBe('/own.png');
    expect(dishPlateArt('Unknown Dish', index, aliases)).toBeNull();
  });
});
