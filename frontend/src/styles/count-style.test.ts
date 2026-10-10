/// <reference types="node" />
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

// Read from disk: Vitest doesn't process CSS imports, so `?raw` would be an empty string.
const raw = readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'global.css'), 'utf8');
/** The stylesheet without comments (comments aren't styles). */
const css = raw.replace(/\/\*[\s\S]*?\*\//g, '');

/** All declarations of a CSS rule, e.g. `.result__count`. */
const rule = (selector: string): string =>
  [...css.matchAll(new RegExp(`${selector.replace('.', '\\.')}\\s*\\{([^}]*)\\}`, 'g'))]
    .map((m) => m[1])
    .join('\n');

describe('large result number', () => {
  it('reads the real stylesheet (guards against an empty file passing vacuously)', () => {
    expect(raw.length).toBeGreaterThan(2000);
    expect(css).toContain('.result__count');
  });

  it('is upright and bold: no italic, no skew', () => {
    expect(rule('.result__count')).toMatch(/font-style:\s*normal/);
    expect(rule('.result__count')).toMatch(/font-weight:\s*800/);
    for (const selector of ['.result__count', '.result__count-number']) {
      expect(rule(selector)).not.toMatch(/italic|skew|oblique/);
    }
  });

  it('is never made italic anywhere in the stylesheet', () => {
    expect(css).not.toMatch(/skewX|font-style:\s*(italic|oblique)/);
  });
});
