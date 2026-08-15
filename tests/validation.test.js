import { describe, expect, it } from 'vitest';

import {
  isLookupableUsername,
  validateNewCredentials,
  validatePublicKey,
} from '../lib/validation';
import { PUBLIC_KEY_HEX_LENGTH } from '../utils/pqcParams';

const validKey = 'a'.repeat(PUBLIC_KEY_HEX_LENGTH);

describe('validateNewCredentials', () => {
  it('accepts a well-formed username and password', () => {
    expect(validateNewCredentials({ username: 'alice_01', password: 'a'.repeat(12) })).toBeNull();
  });

  it.each([
    ['too short', 'ab'],
    ['too long', 'a'.repeat(31)],
    ['containing a space', 'al ice'],
    ['containing punctuation', 'alice!'],
    ['not a string', 42],
  ])('rejects a username %s', (_label, username) => {
    expect(validateNewCredentials({ username, password: 'a'.repeat(12) })).toBeTruthy();
  });

  it('rejects a password below the minimum length', () => {
    expect(validateNewCredentials({ username: 'alice', password: 'short' })).toBeTruthy();
  });
});

describe('validatePublicKey', () => {
  it('accepts a key of exactly the right length', () => {
    expect(validatePublicKey(validKey)).toBeNull();
  });

  // An over-long key would be copied into a fixed-size WASM buffer by every
  // peer who messages this user, so it must never reach the database.
  it('rejects an over-long key', () => {
    expect(validatePublicKey(`${validKey}ff`)).toBeTruthy();
  });

  it('rejects a truncated key', () => {
    expect(validatePublicKey(validKey.slice(0, -2))).toBeTruthy();
  });

  it.each([
    ['non-hex', 'z'.repeat(PUBLIC_KEY_HEX_LENGTH)],
    ['empty', ''],
    ['missing', undefined],
  ])('rejects a %s key', (_label, key) => {
    expect(validatePublicKey(key)).toBeTruthy();
  });
});

describe('isLookupableUsername', () => {
  it('accepts ordinary names and rejects empty or oversized input', () => {
    expect(isLookupableUsername('bob')).toBe(true);
    expect(isLookupableUsername('   ')).toBe(false);
    expect(isLookupableUsername('a'.repeat(65))).toBe(false);
    expect(isLookupableUsername(undefined)).toBe(false);
  });
});
