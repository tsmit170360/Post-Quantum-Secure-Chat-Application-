/**
 * Session token issuing, verification and route protection.
 *
 * This is the single place where a request is turned into a trusted identity.
 * Handlers must read the acting user from `req.user` and never from the query
 * string or request body, both of which are attacker-controlled.
 */

import jwt from 'jsonwebtoken';
import { env } from './env';

export const TOKEN_COOKIE = 'token';
const TOKEN_TTL_SECONDS = 24 * 60 * 60;

export function signToken(payload) {
  return jwt.sign(payload, env('JWT_SECRET'), { expiresIn: TOKEN_TTL_SECONDS });
}

export function verifyToken(token) {
  return jwt.verify(token, env('JWT_SECRET'));
}

function serializeAuthCookie(value, maxAge) {
  // Built by hand to avoid pulling in a cookie-serialisation dependency.
  // The value is a JWT (base64url + '.') so it needs no escaping.
  const attributes = [
    `${TOKEN_COOKIE}=${value}`,
    'Path=/',
    'HttpOnly', // not readable from JavaScript, so XSS cannot exfiltrate it
    'SameSite=Strict', // blocks cross-site request forgery
    `Max-Age=${maxAge}`,
  ];
  if (process.env.NODE_ENV === 'production') attributes.push('Secure');
  return attributes.join('; ');
}

export function setAuthCookie(res, token) {
  res.setHeader('Set-Cookie', serializeAuthCookie(token, TOKEN_TTL_SECONDS));
}

export function clearAuthCookie(res) {
  res.setHeader('Set-Cookie', serializeAuthCookie('', 0));
}

/**
 * Resolve the verified user from a token string, or null when the token is
 * missing, malformed, expired or not signed by us.
 */
export function userFromToken(token) {
  if (!token) return null;
  try {
    const { id, username } = verifyToken(token);
    return id && username ? { id, username } : null;
  } catch {
    return null;
  }
}

/** Resolve the verified user from an HTTP request's cookies. */
export function userFromRequest(req) {
  return userFromToken(req.cookies?.[TOKEN_COOKIE]);
}

function parseCookieHeader(header) {
  const cookies = {};
  if (typeof header !== 'string') return cookies;
  for (const part of header.split(';')) {
    const separator = part.indexOf('=');
    if (separator === -1) continue;
    const key = part.slice(0, separator).trim();
    if (key) cookies[key] = part.slice(separator + 1).trim();
  }
  return cookies;
}

/**
 * Resolve the verified user from a raw Cookie header.
 *
 * Used by the Socket.IO handshake, which has no parsed `cookies` object. The
 * token cannot be passed as a handshake parameter because the cookie is
 * HttpOnly and therefore unreadable by the client.
 */
export function userFromCookieHeader(header) {
  return userFromToken(parseCookieHeader(header)[TOKEN_COOKIE]);
}

/** Wrap an API route so it only runs for authenticated callers. */
export function withAuth(handler) {
  return async (req, res) => {
    const user = userFromRequest(req);
    if (!user) return res.status(401).json({ error: 'Unauthorized' });
    req.user = user;
    return handler(req, res);
  };
}
