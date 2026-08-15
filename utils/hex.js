/**
 * Strict hex <-> byte helpers.
 *
 * Every key, ciphertext and IV crosses a trust boundary as a hex string, and
 * the decoded bytes are copied straight into fixed-size WebAssembly heap
 * allocations. Decoding therefore validates aggressively and fails closed:
 * silently producing short, long or zero-filled buffers would corrupt the
 * WASM heap or weaken the cryptography.
 *
 * Parsing accepts either case so that keys generated before this change (the
 * terminal generator emitted uppercase) keep working. New output is lowercase.
 */

const HEX_PATTERN = /^[0-9a-fA-F]+$/;

/** Encode bytes as a lowercase hex string. */
export function toHex(bytes) {
  let out = '';
  for (const byte of bytes) out += byte.toString(16).padStart(2, '0');
  return out;
}

/**
 * Decode a hex string to bytes.
 *
 * @param {string} value           Hex input (whitespace tolerated).
 * @param {number} [expectedBytes] Exact required length; mismatches throw.
 * @throws {Error} on non-strings, empty, odd-length, non-hex or wrong-length input.
 */
export function fromHex(value, expectedBytes) {
  if (typeof value !== 'string') {
    throw new Error('Expected a hex string');
  }

  const clean = value.trim().replace(/\s+/g, '');
  if (clean.length === 0) throw new Error('Hex string is empty');
  if (clean.length % 2 !== 0) throw new Error('Hex string has an odd length');
  if (!HEX_PATTERN.test(clean)) throw new Error('Hex string contains non-hex characters');

  if (expectedBytes !== undefined && clean.length !== expectedBytes * 2) {
    throw new Error(`Expected ${expectedBytes} bytes but received ${clean.length / 2}`);
  }

  const bytes = new Uint8Array(clean.length / 2);
  for (let i = 0; i < clean.length; i += 2) {
    bytes[i / 2] = parseInt(clean.slice(i, i + 2), 16);
  }
  return bytes;
}

/** True when `value` is hex representing exactly `byteLength` bytes. */
export function isHexOfLength(value, byteLength) {
  if (typeof value !== 'string') return false;
  const clean = value.trim();
  return clean.length === byteLength * 2 && HEX_PATTERN.test(clean);
}
