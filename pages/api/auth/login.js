import { randomBytes } from 'crypto';

import bcrypt from 'bcryptjs';

import { setAuthCookie, signToken } from '../../../lib/auth';
import dbConnect from '../../../lib/dbConnect';
import { enforce } from '../../../lib/rateLimit';
import User from '../../../models/User';

const BCRYPT_COST = 12;

/**
 * A real hash over random input, computed once, used to keep the failure path
 * for an unknown username as slow as the path for a known one.
 */
let decoyHash = null;
function getDecoyHash() {
  if (!decoyHash) decoyHash = bcrypt.hash(randomBytes(32).toString('hex'), BCRYPT_COST);
  return decoyHash;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  // bcrypt verification is deliberately expensive, so an unthrottled login
  // endpoint is both a credential-stuffing target and a CPU-exhaustion vector.
  if (!enforce(req, res, { scope: 'login', limit: 10, windowMs: 15 * 60 * 1000 })) {
    return undefined;
  }

  const { username, password } = req.body ?? {};
  if (typeof username !== 'string' || typeof password !== 'string' || !username || !password) {
    return res.status(400).json({ message: 'Username and password are required' });
  }

  try {
    await dbConnect();

    const user = await User.findOne({ username });

    // Always run a comparison so the response time does not reveal whether the
    // username exists, and keep the message identical for both failure modes.
    const passwordHash = user ? user.password : await getDecoyHash();
    const isMatch = await bcrypt.compare(password, passwordHash);

    if (!user || !isMatch) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const token = signToken({ id: user._id.toString(), username: user.username });

    // The token is delivered only as an HttpOnly cookie; returning it in the
    // body would put it back within reach of any script on the page.
    setAuthCookie(res, token);
    return res.status(200).json({ message: 'Login successful' });
  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({ message: 'Login failed' });
  }
}
