import { beforeAll, describe, expect, it } from 'vitest';

import {
  CIPHERTEXT_BYTES,
  PUBLIC_KEY_BYTES,
  SECRET_KEY_BYTES,
  SHARED_SECRET_BYTES,
} from '../utils/pqcParams';

/**
 * A stand-in for the Emscripten module.
 *
 * The KEM is faked (the real one needs a browser and the compiled .wasm), but
 * everything under test here is ours: length validation before the heap copy,
 * allocation tracking, wiping on release, the envelope shape, and the real
 * WebCrypto AES-GCM round trip. The fake derives the shared secret from a seed
 * byte carried in both keys, so a mismatched key yields a different secret and
 * the GCM tag rejects it -- the same implicit-rejection behaviour as Kyber.
 */
function createFakeModule({ heapBytes = 1 << 20 } = {}) {
  const HEAPU8 = new Uint8Array(heapBytes);
  let next = 8;
  const live = new Map();

  const seedToSecret = (seed) =>
    Uint8Array.from({ length: SHARED_SECRET_BYTES }, (_, i) => (seed + i * 7 + 13) & 0xff);

  return {
    calledRun: true,
    HEAPU8,
    _malloc(size) {
      const ptr = next;
      next += size + 8;
      if (next > heapBytes) return 0;
      live.set(ptr, size);
      return ptr;
    },
    _free(ptr) {
      live.delete(ptr);
    },
    _get_pubkey_size: () => PUBLIC_KEY_BYTES,
    _get_privkey_size: () => SECRET_KEY_BYTES,
    _get_ciphertext_size: () => CIPHERTEXT_BYTES,
    _get_shared_secret_size: () => SHARED_SECRET_BYTES,
    _generate_kyber_keys(pkPtr, skPtr) {
      const seed = 0x5a;
      HEAPU8.fill(seed, pkPtr, pkPtr + PUBLIC_KEY_BYTES);
      HEAPU8.fill(seed, skPtr, skPtr + SECRET_KEY_BYTES);
      return 0;
    },
    _encapsulate_kyber(ctPtr, ssPtr, pkPtr) {
      const seed = HEAPU8[pkPtr];
      HEAPU8.fill(seed, ctPtr, ctPtr + CIPHERTEXT_BYTES);
      HEAPU8.set(seedToSecret(seed), ssPtr);
      return 0;
    },
    _decapsulate_kyber(ssPtr, _ctPtr, skPtr) {
      HEAPU8.set(seedToSecret(HEAPU8[skPtr]), ssPtr);
      return 0;
    },
    /** Test helper: allocations not yet freed. */
    liveAllocations: () => live.size,
  };
}

const hexOf = (byte, count) => byte.toString(16).padStart(2, '0').repeat(count);

let crypto_;
let fake;

beforeAll(async () => {
  globalThis.window = globalThis;
  fake = createFakeModule();
  globalThis.Module = fake;
  crypto_ = await import('../utils/crypto');
});

describe('encryptMessage / decryptMessage', () => {
  const recipientPub = hexOf(0x5a, PUBLIC_KEY_BYTES);
  const recipientSec = hexOf(0x5a, SECRET_KEY_BYTES);

  it('round-trips a message', async () => {
    const envelope = await crypto_.encryptMessage(recipientPub, null, 'hello quantum world');
    expect(await crypto_.decryptMessage(envelope, recipientSec)).toBe('hello quantum world');
  });

  it('round-trips non-ASCII text', async () => {
    const envelope = await crypto_.encryptMessage(recipientPub, null, 'héllo 🌍 مرحبا');
    expect(await crypto_.decryptMessage(envelope, recipientSec)).toBe('héllo 🌍 مرحبا');
  });

  it('produces a fresh IV per message, so identical plaintexts differ', async () => {
    const a = await crypto_.encryptMessage(recipientPub, null, 'same');
    const b = await crypto_.encryptMessage(recipientPub, null, 'same');
    expect(a.aesIv).not.toBe(b.aesIv);
    expect(a.encryptedMessage).not.toBe(b.encryptedMessage);
  });

  it('emits a complete, correctly sized envelope', async () => {
    const envelope = await crypto_.encryptMessage(recipientPub, null, 'x');
    expect(envelope.kemCiphertext).toHaveLength(CIPHERTEXT_BYTES * 2);
    expect(envelope.aesIv).toHaveLength(24);
    expect(envelope.encryptedMessage.length).toBeGreaterThan(0);
    expect(envelope.senderCopy).toBeUndefined();
  });

  it('rejects a wrong private key via the AES-GCM tag', async () => {
    const envelope = await crypto_.encryptMessage(recipientPub, null, 'secret');
    await expect(crypto_.decryptMessage(envelope, hexOf(0x77, SECRET_KEY_BYTES))).rejects.toThrow();
  });
});

describe('sender copy', () => {
  it('lets the sender re-read their own message', async () => {
    const envelope = await crypto_.encryptMessage(
      hexOf(0x5a, PUBLIC_KEY_BYTES),
      hexOf(0x21, PUBLIC_KEY_BYTES),
      'note to self'
    );

    expect(envelope.senderCopy).toBeDefined();
    // Recipient opens the outer envelope, sender opens their own copy.
    expect(await crypto_.decryptMessage(envelope, hexOf(0x5a, SECRET_KEY_BYTES))).toBe('note to self');
    expect(await crypto_.decryptMessage(envelope.senderCopy, hexOf(0x21, SECRET_KEY_BYTES))).toBe(
      'note to self'
    );
  });

  it('gives the two copies independent ciphertexts', async () => {
    const envelope = await crypto_.encryptMessage(
      hexOf(0x5a, PUBLIC_KEY_BYTES),
      hexOf(0x21, PUBLIC_KEY_BYTES),
      'note'
    );
    expect(envelope.kemCiphertext).not.toBe(envelope.senderCopy.kemCiphertext);
  });
});

describe('input length validation', () => {
  // Regression tests for the heap overflow: an over-long key used to be copied
  // straight past the end of its fixed-size allocation.
  it('refuses an over-long public key', async () => {
    await expect(
      crypto_.encryptMessage(hexOf(0xaa, PUBLIC_KEY_BYTES + 200), null, 'hi')
    ).rejects.toThrow(/Expected 800 bytes/);
  });

  it('refuses a truncated public key', async () => {
    await expect(crypto_.encryptMessage(hexOf(0xaa, 10), null, 'hi')).rejects.toThrow(
      /Expected 800 bytes/
    );
  });

  it('refuses an over-long private key', async () => {
    const envelope = await crypto_.encryptMessage(hexOf(0x5a, PUBLIC_KEY_BYTES), null, 'hi');
    await expect(
      crypto_.decryptMessage(envelope, hexOf(0xbb, SECRET_KEY_BYTES + 100))
    ).rejects.toThrow(/Expected 1632 bytes/);
  });

  it('refuses a ciphertext of the wrong length', async () => {
    await expect(
      crypto_.decryptMessage(
        { kemCiphertext: hexOf(0x01, 5), aesIv: hexOf(0x02, 12), encryptedMessage: hexOf(0x03, 20) },
        hexOf(0x5a, SECRET_KEY_BYTES)
      )
    ).rejects.toThrow(/Expected 768 bytes/);
  });

  it('refuses non-hex key material', async () => {
    await expect(crypto_.encryptMessage('zz'.repeat(PUBLIC_KEY_BYTES), null, 'hi')).rejects.toThrow(
      /non-hex/
    );
  });
});

describe('heap hygiene', () => {
  it('frees every allocation, including on the failure path', async () => {
    const before = fake.liveAllocations();
    await crypto_.encryptMessage(hexOf(0x5a, PUBLIC_KEY_BYTES), null, 'ok');
    await crypto_.encryptMessage(hexOf(0xaa, 4), null, 'bad').catch(() => {});
    expect(fake.liveAllocations()).toBe(before);
  });

  it('wipes key material out of the heap after use', async () => {
    await crypto_.encryptMessage(hexOf(0x5a, PUBLIC_KEY_BYTES), null, 'wipe me');

    // The distinctive 0x5a key bytes must not survive anywhere in the heap.
    let run = 0;
    let longestRun = 0;
    for (const byte of fake.HEAPU8) {
      run = byte === 0x5a ? run + 1 : 0;
      if (run > longestRun) longestRun = run;
    }
    expect(longestRun).toBeLessThan(PUBLIC_KEY_BYTES);
  });
});
