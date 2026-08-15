/**
 * Client-side hybrid encryption: Kyber-512 KEM (compiled C, via WebAssembly)
 * for key encapsulation, AES-256-GCM (WebCrypto) for the message itself.
 *
 * Private keys and shared secrets never leave the browser.
 */

import { fromHex, toHex } from './hex';
import {
  CIPHERTEXT_BYTES,
  PUBLIC_KEY_BYTES,
  SECRET_KEY_BYTES,
  SHARED_SECRET_BYTES,
} from './pqcParams';

const AES_IV_BYTES = 12;
const WASM_READY_TIMEOUT_MS = 15000;

let modulePromise = null;
let cachedParams = null;

/**
 * Resolve once the Emscripten runtime is genuinely usable.
 *
 * `calledRun` is the only reliable readiness signal. Emscripten pre-defines
 * every export as a throwing stub, so probing for `_malloc` succeeds before the
 * module is initialised, and `onRuntimeInitialized` becomes a setter-only
 * property that always reads back as undefined (and aborts if assigned).
 */
export function getWasmModule() {
  if (modulePromise) return modulePromise;

  modulePromise = new Promise((resolve, reject) => {
    if (typeof window === 'undefined') {
      reject(new Error('The post-quantum module is only available in the browser'));
      return;
    }

    const deadline = Date.now() + WASM_READY_TIMEOUT_MS;
    const poll = () => {
      if (window.Module?.calledRun) {
        resolve(window.Module);
        return;
      }
      if (Date.now() > deadline) {
        modulePromise = null; // allow a later retry
        reject(new Error('The post-quantum module failed to load. Please reload the page.'));
        return;
      }
      setTimeout(poll, 50);
    };
    poll();
  });

  return modulePromise;
}

/**
 * Read the algorithm parameters the module was built with and confirm they
 * match what the rest of the app expects. A mismatch means the WASM was rebuilt
 * against a different algorithm, which must not silently change buffer sizes.
 */
function readParams(Module) {
  if (cachedParams) return cachedParams;

  const params = {
    publicKeyBytes: Module._get_pubkey_size(),
    secretKeyBytes: Module._get_privkey_size(),
    ciphertextBytes: Module._get_ciphertext_size(),
    sharedSecretBytes: Module._get_shared_secret_size(),
  };

  const expected = {
    publicKeyBytes: PUBLIC_KEY_BYTES,
    secretKeyBytes: SECRET_KEY_BYTES,
    ciphertextBytes: CIPHERTEXT_BYTES,
    sharedSecretBytes: SHARED_SECRET_BYTES,
  };

  for (const [name, value] of Object.entries(expected)) {
    if (params[name] !== value) {
      throw new Error(`WASM parameter mismatch: ${name} is ${params[name]}, expected ${value}`);
    }
  }

  cachedParams = params;
  return params;
}

/**
 * The currently bundled WASM declares the KEM wrappers as `void`, so calls
 * return undefined. keygen.c now returns an int status instead; treating
 * undefined as success keeps the existing binary working while making the
 * status meaningful as soon as the module is rebuilt.
 */
function assertKemOk(status, operation) {
  if (typeof status === 'number' && status !== 0) {
    throw new Error(`${operation} failed (status ${status})`);
  }
}

/**
 * Tracks WASM heap allocations so every one is wiped and freed, including on
 * the error path. `free` alone would leave key material readable in the heap.
 */
class Scratch {
  constructor(Module) {
    this.Module = Module;
    this.blocks = [];
  }

  alloc(size) {
    const ptr = this.Module._malloc(size);
    if (!ptr) throw new Error('WASM memory allocation failed');
    this.blocks.push({ ptr, size });
    return ptr;
  }

  /** Copy exactly `size` bytes; a mismatch would write past the allocation. */
  write(ptr, bytes, size) {
    if (bytes.length !== size) {
      throw new Error(`Refusing to write ${bytes.length} bytes into a ${size}-byte buffer`);
    }
    this.Module.HEAPU8.set(bytes, ptr);
  }

  read(ptr, size) {
    return new Uint8Array(this.Module.HEAPU8.buffer, ptr, size).slice();
  }

  release() {
    for (const { ptr, size } of this.blocks) {
      this.Module.HEAPU8.fill(0, ptr, ptr + size);
      this.Module._free(ptr);
    }
    this.blocks.length = 0;
  }
}

/** Encapsulate to one public key and seal the plaintext under the shared secret. */
async function sealTo(Module, params, publicKeyHex, plaintextBytes) {
  const scratch = new Scratch(Module);
  let sharedSecret = null;

  try {
    // Length is enforced during decoding, so the copy below can never overrun.
    const publicKey = fromHex(publicKeyHex, params.publicKeyBytes);

    const pkPtr = scratch.alloc(params.publicKeyBytes);
    const ctPtr = scratch.alloc(params.ciphertextBytes);
    const ssPtr = scratch.alloc(params.sharedSecretBytes);

    scratch.write(pkPtr, publicKey, params.publicKeyBytes);
    assertKemOk(Module._encapsulate_kyber(ctPtr, ssPtr, pkPtr), 'KEM encapsulation');

    const kemCiphertext = scratch.read(ctPtr, params.ciphertextBytes);
    sharedSecret = scratch.read(ssPtr, params.sharedSecretBytes);

    const iv = window.crypto.getRandomValues(new Uint8Array(AES_IV_BYTES));
    const aesKey = await window.crypto.subtle.importKey('raw', sharedSecret, 'AES-GCM', false, [
      'encrypt',
    ]);
    const sealed = await window.crypto.subtle.encrypt({ name: 'AES-GCM', iv }, aesKey, plaintextBytes);

    return {
      kemCiphertext: toHex(kemCiphertext),
      aesIv: toHex(iv),
      encryptedMessage: toHex(new Uint8Array(sealed)),
    };
  } finally {
    sharedSecret?.fill(0);
    scratch.release();
  }
}

/**
 * Encrypt a message for the recipient, plus a second copy encapsulated to the
 * sender's own key so they can re-read their own history.
 *
 * @param {string} recipientPublicKeyHex
 * @param {string|null} senderPublicKeyHex omit to skip the sender's copy
 * @param {string} messageText
 */
export async function encryptMessage(recipientPublicKeyHex, senderPublicKeyHex, messageText) {
  const Module = await getWasmModule();
  const params = readParams(Module);
  const plaintext = new TextEncoder().encode(messageText);

  try {
    const envelope = await sealTo(Module, params, recipientPublicKeyHex, plaintext);
    if (senderPublicKeyHex) {
      envelope.senderCopy = await sealTo(Module, params, senderPublicKeyHex, plaintext);
    }
    return envelope;
  } finally {
    plaintext.fill(0);
  }
}

/**
 * Decapsulate and open one envelope.
 *
 * Kyber decapsulation uses implicit rejection: a wrong secret key yields a
 * different shared secret rather than an error, so it is the AES-GCM
 * authentication tag that actually rejects a mismatched key. The key-ownership
 * check on the chat screen relies on this.
 */
export async function decryptMessage(envelope, secretKeyHex) {
  const Module = await getWasmModule();
  const params = readParams(Module);
  const scratch = new Scratch(Module);
  let sharedSecret = null;
  let secretKey = null;

  try {
    secretKey = fromHex(secretKeyHex, params.secretKeyBytes);
    const kemCiphertext = fromHex(envelope?.kemCiphertext, params.ciphertextBytes);
    const iv = fromHex(envelope?.aesIv, AES_IV_BYTES);
    const sealed = fromHex(envelope?.encryptedMessage);

    const skPtr = scratch.alloc(params.secretKeyBytes);
    const ctPtr = scratch.alloc(params.ciphertextBytes);
    const ssPtr = scratch.alloc(params.sharedSecretBytes);

    scratch.write(skPtr, secretKey, params.secretKeyBytes);
    scratch.write(ctPtr, kemCiphertext, params.ciphertextBytes);

    assertKemOk(Module._decapsulate_kyber(ssPtr, ctPtr, skPtr), 'KEM decapsulation');
    sharedSecret = scratch.read(ssPtr, params.sharedSecretBytes);

    const aesKey = await window.crypto.subtle.importKey('raw', sharedSecret, 'AES-GCM', false, [
      'decrypt',
    ]);
    const opened = await window.crypto.subtle.decrypt({ name: 'AES-GCM', iv }, aesKey, sealed);

    return new TextDecoder().decode(opened);
  } finally {
    secretKey?.fill(0);
    sharedSecret?.fill(0);
    scratch.release();
  }
}

/** Generate a fresh Kyber keypair. Returns lowercase hex. */
export async function generateKeyPair() {
  const Module = await getWasmModule();
  const params = readParams(Module);
  const scratch = new Scratch(Module);

  try {
    const pkPtr = scratch.alloc(params.publicKeyBytes);
    const skPtr = scratch.alloc(params.secretKeyBytes);

    assertKemOk(Module._generate_kyber_keys(pkPtr, skPtr), 'Key generation');

    return {
      publicKey: toHex(scratch.read(pkPtr, params.publicKeyBytes)),
      privateKey: toHex(scratch.read(skPtr, params.secretKeyBytes)),
    };
  } finally {
    scratch.release();
  }
}
