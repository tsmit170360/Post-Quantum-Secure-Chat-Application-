import { beforeEach, describe, expect, it } from 'vitest';

import { clearImportedKeys, setImportedKeys, takeImportedKeys } from '../utils/keyStore';

const keys = { publicKey: 'aa'.repeat(800), privateKey: 'bb'.repeat(1632) };

beforeEach(() => clearImportedKeys());

describe('keyStore', () => {
  it('hands over a staged keypair', () => {
    setImportedKeys(keys);
    expect(takeImportedKeys()).toEqual(keys);
  });

  it('returns null when nothing was staged', () => {
    expect(takeImportedKeys()).toBeNull();
  });

  // React StrictMode runs mount effects twice; the second read must not
  // overwrite the already-consumed value with null.
  it('yields the keypair only once', () => {
    setImportedKeys(keys);
    expect(takeImportedKeys()).toEqual(keys);
    expect(takeImportedKeys()).toBeNull();
  });

  it('drops a staged keypair on clear', () => {
    setImportedKeys(keys);
    clearImportedKeys();
    expect(takeImportedKeys()).toBeNull();
  });

  it('replaces a previously staged keypair', () => {
    setImportedKeys(keys);
    setImportedKeys({ publicKey: 'cc', privateKey: 'dd' });
    expect(takeImportedKeys()).toEqual({ publicKey: 'cc', privateKey: 'dd' });
  });

  it('never writes to persistent storage', () => {
    const writes = [];
    globalThis.localStorage = { setItem: (k, v) => writes.push([k, v]), getItem: () => null };
    globalThis.sessionStorage = { setItem: (k, v) => writes.push([k, v]), getItem: () => null };

    setImportedKeys(keys);
    takeImportedKeys();

    expect(writes).toEqual([]);
  });
});
