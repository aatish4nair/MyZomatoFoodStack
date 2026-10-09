import { describe, expect, it } from 'vitest';
import { loadEnv } from './env.js';

describe('loadEnv', () => {
  it('applies safe defaults (loopback host, local frontend origin)', () => {
    const env = loadEnv({});
    expect(env.HOST).toBe('127.0.0.1');
    expect(env.PORT).toBe(3000);
    expect(env.CORS_ORIGINS).toEqual(['http://localhost:5173']);
  });

  it('parses a comma-separated origin list', () => {
    const env = loadEnv({ CORS_ORIGINS: 'http://localhost:5173, https://food.example.com' });
    expect(env.CORS_ORIGINS).toEqual(['http://localhost:5173', 'https://food.example.com']);
  });

  it.each([
    ['PORT', 'not-a-number'],
    ['PORT', '70000'],
    ['NODE_ENV', 'staging'],
    ['CORS_ORIGINS', '*'],
    ['CORS_ORIGINS', 'https://example.com/path'],
  ])('rejects %s=%s', (name, value) => {
    expect(() => loadEnv({ [name]: value })).toThrow(name);
  });

  it('does not echo the rejected value in the error message', () => {
    const secretLooking = 'super-secret-value-123';
    expect(() => loadEnv({ PORT: secretLooking })).toThrow(
      expect.objectContaining({ message: expect.not.stringContaining(secretLooking) as string }),
    );
  });
});
