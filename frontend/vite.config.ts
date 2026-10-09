import react from '@vitejs/plugin-react';
import type { Plugin } from 'vite';
import { defineConfig } from 'vitest/config';

/**
 * Content Security Policy for the production build. Added as a <meta> tag so it
 * applies wherever the static files are hosted; the host should also send it as
 * a real header (frame-ancestors only works as a header).
 * Not applied to the dev server, whose hot-reload needs inline scripts.
 */
const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self'",
  "img-src 'self' data:",
  "font-src 'self'",
  "connect-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join('; ');

function contentSecurityPolicy(): Plugin {
  return {
    name: 'content-security-policy',
    apply: 'build',
    transformIndexHtml: () => [
      {
        tag: 'meta',
        attrs: { 'http-equiv': 'Content-Security-Policy', content: CSP },
        injectTo: 'head-prepend',
      },
    ],
  };
}

export default defineConfig({
  plugins: [react(), contentSecurityPolicy()],
  // Resolve @food-stack/shared to its TypeScript source during dev, build and tests.
  resolve: { conditions: ['source', 'module', 'browser', 'development|production'] },
  server: {
    host: '127.0.0.1',
    port: 5173,
    strictPort: true,
    // The browser only ever talks to its own origin; Vite forwards /api to the backend.
    proxy: { '/api': 'http://127.0.0.1:3000' },
  },
  build: { sourcemap: false },
  test: {
    name: 'frontend',
    environment: 'jsdom',
    include: ['src/**/*.test.{ts,tsx}'],
    setupFiles: ['./src/test/setup.ts'],
  },
});
