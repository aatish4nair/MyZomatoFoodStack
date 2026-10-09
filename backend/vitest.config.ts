import { defineProject } from 'vitest/config';

export default defineProject({
  // Resolve @food-stack/shared to its TypeScript source, so tests never need a prior build.
  ssr: { resolve: { conditions: ['source'] } },
  test: {
    name: 'backend',
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
