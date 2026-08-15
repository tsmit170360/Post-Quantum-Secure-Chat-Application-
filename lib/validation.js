/**
 * Input validation shared by the API routes.
 *
 * Kept dependency-free and deliberately strict: `pqcPublicKey` in particular is
 * copied into a fixed-size WebAssembly allocation by every peer who messages
 * this user, so an over-long value stored here would corrupt their heap.
 *
 * Note these rules are applied at *registration* only. Login intentionally does
 * not enforce them, so accounts created before this validation existed keep
 * working.
 */

import { isHexOfLength } from '../utils/hex';
import { PUBLIC_KEY_BYTES } from '../utils/pqcParams';

export const USERNAME_PATTERN = /^[a-zA-Z0-9_]{3,30}$/;
export const MIN_PASSWORD_LENGTH = 12;

/**
 * @returns {string|null} an error message, or null when the input is valid.
 */
export function validateNewCredentials({ username, password }) {
  if (typeof username !== 'string' || !USERNAME_PATTERN.test(username)) {
    return 'Username must be 3-30 characters using only letters, numbers or underscores.';
  }
  if (typeof password !== 'string' || password.length < MIN_PASSWORD_LENGTH) {
    return `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`;
  }
  return null;
}

/** @returns {string|null} an error message, or null when the key is valid. */
export function validatePublicKey(pqcPublicKey) {
  if (!isHexOfLength(pqcPublicKey, PUBLIC_KEY_BYTES)) {
    return `Public key must be exactly ${PUBLIC_KEY_BYTES * 2} hex characters (${PUBLIC_KEY_BYTES} bytes).`;
  }
  return null;
}

/** True when `value` is a plausible username to look up (no policy applied). */
export function isLookupableUsername(value) {
  return typeof value === 'string' && value.trim().length > 0 && value.length <= 64;
}
