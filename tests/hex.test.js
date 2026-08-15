import { describe, expect, it } from 'vitest';

import { fromHex, isHexOfLength, toHex } from '../utils/hex';

describe('toHex', () => {
  it('encodes bytes as lowercase hex', () => {
    expect(toHex(new Uint8Array([0x00, 0x0f, 0xa1, 0xff]))).toBe('000fa1ff');
  });

  it('round-trips with fromHex', () => {
    const bytes = new Uint8Array([1, 2, 3, 250, 251, 0]);
    expect(Array.from(fromHex(toHex(bytes)))).toEqual(Array.from(bytes));
  });
});

describe('fromHex', () => {
  it('accepts either case, so keys created before this change still parse', () => {
    expect(Array.from(fromHex('AbCd'))).toEqual([0xab, 0xcd]);
  });

  it('tolerates surrounding and internal whitespace', () => {
    expect(Array.from(fromHex('  a1 b2\n'))).toEqual([0xa1, 0xb2]);
  });

  // These are the inputs that previously produced silently wrong buffers and
  // fed oversized copies into the fixed-size WASM allocations.
  it.each([
    ['a non-string', 123],
    ['an empty string', ''],
    ['odd length', 'abc'],
    ['non-hex characters', 'zzzz'],
    ['partially non-hex', 'a1g2'],
  ])('rejects %s', (_label, input) => {
    expect(() => fromHex(input)).toThrow();
  });

  it('rejects input that is shorter than the expected length', () => {
    expect(() => fromHex('a1b2', 4)).toThrow(/Expected 4 bytes/);
  });

  it('rejects input that is longer than the expected length', () => {
    expect(() => fromHex('a1b2c3d4e5f6', 2)).toThrow(/Expected 2 bytes/);
  });

  it('accepts input of exactly the expected length', () => {
    expect(fromHex('a1b2', 2)).toHaveLength(2);
  });
});

describe('isHexOfLength', () => {
  it('is true only for hex of the exact byte length', () => {
    expect(isHexOfLength('a1b2', 2)).toBe(true);
    expect(isHexOfLength('a1b2', 3)).toBe(false);
    expect(isHexOfLength('zzzz', 2)).toBe(false);
    expect(isHexOfLength(null, 2)).toBe(false);
  });
});
