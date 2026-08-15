/**
 * Expected Kyber-512 parameter sizes, in bytes.
 *
 * The WebAssembly module reports these at runtime and is the authority for the
 * client; these constants let the server validate key material without loading
 * WASM, and let the client detect a mismatch if the module is ever rebuilt
 * against a different algorithm (see verifyModuleParams in utils/crypto.js).
 */

export const PUBLIC_KEY_BYTES = 800;
export const SECRET_KEY_BYTES = 1632;
export const CIPHERTEXT_BYTES = 768;
export const SHARED_SECRET_BYTES = 32;

export const PUBLIC_KEY_HEX_LENGTH = PUBLIC_KEY_BYTES * 2;
export const SECRET_KEY_HEX_LENGTH = SECRET_KEY_BYTES * 2;
