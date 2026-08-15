import { beforeEach, describe, expect, it } from 'vitest';

import { clientKey, consume, resetAll } from '../lib/rateLimit';

beforeEach(() => resetAll());

describe('consume', () => {
  it('allows up to the limit and blocks beyond it', () => {
    const options = { limit: 3, windowMs: 60_000 };
    expect(consume('a', options).allowed).toBe(true);
    expect(consume('a', options).allowed).toBe(true);
    expect(consume('a', options).allowed).toBe(true);

    const blocked = consume('a', options);
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfter).toBeGreaterThan(0);
  });

  it('tracks keys independently', () => {
    const options = { limit: 1, windowMs: 60_000 };
    expect(consume('a', options).allowed).toBe(true);
    expect(consume('a', options).allowed).toBe(false);
    expect(consume('b', options).allowed).toBe(true);
  });

  it('starts a fresh window once the old one has elapsed', () => {
    expect(consume('a', { limit: 1, windowMs: 0 }).allowed).toBe(true);
    expect(consume('a', { limit: 1, windowMs: 0 }).allowed).toBe(true);
  });
});

describe('clientKey', () => {
  it('prefers the first x-forwarded-for entry', () => {
    expect(clientKey({ headers: { 'x-forwarded-for': '1.2.3.4, 5.6.7.8' } })).toBe('1.2.3.4');
  });

  it('falls back to the socket address', () => {
    expect(clientKey({ headers: {}, socket: { remoteAddress: '9.9.9.9' } })).toBe('9.9.9.9');
  });

  it('never returns undefined', () => {
    expect(clientKey({ headers: {} })).toBe('unknown');
  });
});
