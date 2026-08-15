/**
 * In-memory hand-off for keys imported on the login page.
 *
 * The import panel originally wrote both keys to localStorage, which keeps a
 * private key in plaintext, readable by any script on the origin, for as long
 * as the browser profile exists. This module keeps them in a module-level
 * variable instead: they live only for the current page session, are never
 * persisted, and are dropped as soon as they are consumed.
 *
 * Module state survives client-side navigation (login -> /chat) but not a full
 * reload, which matches the app's stated model of holding private keys in
 * browser memory only.
 */

let importedKeys = null;

/** Hold a keypair for hand-off to the chat screen. */
export function setImportedKeys({ publicKey, privateKey }) {
  importedKeys = { publicKey, privateKey };
}

/**
 * Return the pending keypair, if any, and drop it from memory.
 * Consuming on read keeps the window in which the key is held as short as
 * possible; callers that need it afterwards hold it in their own state.
 */
export function takeImportedKeys() {
  const keys = importedKeys;
  importedKeys = null;
  return keys;
}

/** Drop any pending keypair without reading it. */
export function clearImportedKeys() {
  importedKeys = null;
}
