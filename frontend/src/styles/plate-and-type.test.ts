/// <reference types="node" />
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const raw = readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'global.css'), 'utf8');
const css = raw.replace(/\/\*[\s\S]*?\*\//g, '');
const rules = (selector: string): string =>
  [
    ...css.matchAll(
      new RegExp(`(?:^|\\n)\\s*${selector.replace(/\./g, '\\.')}\\s*\\{([^}]*)\\}`, 'g'),
    ),
  ]
    .map((m) => m[1])
    .join('\n');
const reducedMotion = css.slice(css.indexOf('@media (prefers-reduced-motion: reduce)'));

describe('plate entrance animation', () => {
  it('fades the food in while rising and scaling from 95%, in 300–450 ms, without looping', () => {
    const food = rules('.plate__food');
    const match = /animation:\s*food-in\s+([\d.]+)s/.exec(food);
    expect(match).not.toBeNull();
    const seconds = Number(match?.[1]);
    expect(seconds).toBeGreaterThanOrEqual(0.3);
    expect(seconds).toBeLessThanOrEqual(0.45);
    expect(food).not.toMatch(/infinite|alternate/);
    const keyframes = /@keyframes food-in\s*\{([\s\S]*?)\n\}/.exec(css)?.[1] ?? '';
    expect(keyframes).toMatch(/opacity:\s*0/);
    expect(keyframes).toMatch(/scale\(0\.95\)/);
    expect(keyframes).not.toMatch(/rotate/);
  });

  it('keeps the plate itself still (fade only, no movement)', () => {
    const keyframes = /@keyframes plate-appear\s*\{([\s\S]*?)\n\}/.exec(css)?.[1] ?? '';
    expect(keyframes).toMatch(/opacity/);
    expect(keyframes).not.toMatch(/transform|translate|scale/);
  });

  it('turns the plate and food animations off for reduced motion', () => {
    expect(reducedMotion).toMatch(/\.plate__food/);
    expect(reducedMotion).toMatch(/\.plate,/);
    expect(reducedMotion).toMatch(/animation:\s*none/);
  });
});

describe('compact, responsive typography', () => {
  it.each([
    '.app__title',
    '.search__input',
    '.result__count',
    '.result__name',
    '.result__paid',
    '.result__details',
  ])('%s uses clamp() bounded by both viewport width and height', (selector) => {
    expect(rules(selector)).toMatch(/font-size:\s*clamp\([^;]*min\([^;]*vw[^;]*vh/);
  });

  it('keeps the hierarchy: count > amount > name > details (by maximum size)', () => {
    const max = (selector: string) =>
      Number(/font-size:\s*clamp\([^;]*,\s*(\d+)px\)/.exec(rules(selector))?.[1]);
    expect(max('.result__count')).toBeGreaterThan(max('.result__paid'));
    expect(max('.result__paid')).toBeGreaterThan(max('.result__name'));
    expect(max('.result__name')).toBeGreaterThan(max('.result__details'));
    expect(max('.result__count')).toBeLessThanOrEqual(120);
  });

  it('wraps long dish names instead of overlapping the plate', () => {
    expect(rules('.result__name')).toMatch(/overflow-wrap:\s*anywhere/);
    expect(rules('.app__left')).toMatch(/min-width:\s*0/);
  });

  it('caps the plate by viewport height so the footer collage stays in view', () => {
    expect(rules('.plate')).toMatch(/width:\s*min\([^;]*vh\)/);
  });
});
