import { beforeAll, describe, expect, it } from 'vitest';

process.env.JWT_SECRET = process.env.JWT_SECRET ?? 'test-secret-that-is-at-least-32-characters-long';
process.env.MONGODB_URI = process.env.MONGODB_URI ?? 'mongodb://localhost:27017/test';

let auth;
let jwt;

beforeAll(async () => {
  auth = await import('../lib/auth');
  jwt = (await import('jsonwebtoken')).default;
});

function mockRes() {
  return {
    headers: {},
    statusCode: null,
    body: null,
    setHeader(name, value) {
      this.headers[name] = value;
    },
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
  };
}

describe('token handling', () => {
  it('round-trips a signed token', () => {
    const token = auth.signToken({ id: '1', username: 'alice' });
    expect(auth.userFromToken(token)).toEqual({ id: '1', username: 'alice' });
  });

  it('rejects a token signed with a different secret', () => {
    const forged = jwt.sign({ id: '1', username: 'mallory' }, 'a-completely-different-secret-value');
    expect(auth.userFromToken(forged)).toBeNull();
  });

  it('rejects an unsigned "none" style token and other garbage', () => {
    expect(auth.userFromToken('not.a.token')).toBeNull();
    expect(auth.userFromToken('')).toBeNull();
    expect(auth.userFromToken(undefined)).toBeNull();
  });

  it('rejects an expired token', () => {
    const expired = jwt.sign({ id: '1', username: 'alice' }, process.env.JWT_SECRET, {
      expiresIn: -10,
    });
    expect(auth.userFromToken(expired)).toBeNull();
  });
});

describe('cookie flags', () => {
  it('sets HttpOnly, SameSite and a path on the session cookie', () => {
    const res = mockRes();
    auth.setAuthCookie(res, 'token-value');
    const cookie = res.headers['Set-Cookie'];

    expect(cookie).toContain('HttpOnly');
    expect(cookie).toContain('SameSite=Strict');
    expect(cookie).toContain('Path=/');
    expect(cookie).toContain('Max-Age=86400');
  });

  it('expires the cookie on logout', () => {
    const res = mockRes();
    auth.clearAuthCookie(res);
    expect(res.headers['Set-Cookie']).toContain('Max-Age=0');
  });
});

describe('cookie header parsing', () => {
  it('extracts the session token from a multi-cookie header', () => {
    const token = auth.signToken({ id: '7', username: 'bob' });
    const user = auth.userFromCookieHeader(`theme=dark; token=${token}; other=1`);
    expect(user).toEqual({ id: '7', username: 'bob' });
  });

  it('returns null when the header has no token or is absent', () => {
    expect(auth.userFromCookieHeader('theme=dark')).toBeNull();
    expect(auth.userFromCookieHeader(undefined)).toBeNull();
  });
});

describe('withAuth', () => {
  it('rejects a request with no cookie', async () => {
    const res = mockRes();
    let called = false;
    await auth.withAuth(async () => {
      called = true;
    })({ cookies: {} }, res);

    expect(called).toBe(false);
    expect(res.statusCode).toBe(401);
  });

  it('rejects a forged token', async () => {
    const res = mockRes();
    let called = false;
    const forged = jwt.sign({ id: '1', username: 'mallory' }, 'wrong-secret');
    await auth.withAuth(async () => {
      called = true;
    })({ cookies: { token: forged } }, res);

    expect(called).toBe(false);
    expect(res.statusCode).toBe(401);
  });

  it('passes the verified identity through on success', async () => {
    const res = mockRes();
    const token = auth.signToken({ id: '9', username: 'carol' });
    let seen = null;
    await auth.withAuth(async (req) => {
      seen = req.user;
    })({ cookies: { token } }, res);

    expect(seen).toEqual({ id: '9', username: 'carol' });
  });
});
