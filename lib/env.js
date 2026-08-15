/**
 * Centralised environment configuration.
 *
 * Validation is lazy (triggered on first access) rather than at import time so
 * that a missing variable surfaces as a clear runtime error instead of breaking
 * the build while Next.js is collecting page data.
 */

const REQUIRED = ['MONGODB_URI', 'JWT_SECRET'];
const MIN_SECRET_LENGTH = 32;

let validated = false;

export function assertEnv() {
  if (validated) return;

  const missing = REQUIRED.filter((name) => !process.env[name]);
  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variable(s): ${missing.join(', ')}. ` +
        'Copy .env.example to .env.local and provide the values.'
    );
  }

  if (process.env.JWT_SECRET.length < MIN_SECRET_LENGTH) {
    throw new Error(
      `JWT_SECRET must be at least ${MIN_SECRET_LENGTH} characters. ` +
        'Generate one with: openssl rand -hex 32'
    );
  }

  validated = true;
}

/** Read a validated environment variable. */
export function env(name) {
  assertEnv();
  return process.env[name];
}
