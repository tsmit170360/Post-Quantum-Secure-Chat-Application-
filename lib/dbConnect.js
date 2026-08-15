import mongoose from 'mongoose';

import { env } from './env';

/**
 * Global is used here to maintain a cached connection across hot reloads in
 * development. This prevents connections from growing exponentially during API
 * route-based development.
 */
let cached = global.mongoose;

if (!cached) {
  cached = global.mongoose = { conn: null, promise: null };
}

async function dbConnect() {
  if (cached.conn) {
    return cached.conn;
  }

  if (!cached.promise) {
    // Resolved lazily so a missing variable fails the request with a clear
    // message rather than throwing while Next.js collects page data.
    cached.promise = mongoose.connect(env('MONGODB_URI'), { bufferCommands: false });
  }

  try {
    cached.conn = await cached.promise;
  } catch (e) {
    cached.promise = null;
    throw e;
  }

  return cached.conn;
}

export default dbConnect;
