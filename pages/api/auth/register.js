import bcrypt from 'bcryptjs';

import dbConnect from '../../../lib/dbConnect';
import { enforce } from '../../../lib/rateLimit';
import { validateNewCredentials, validatePublicKey } from '../../../lib/validation';
import User from '../../../models/User';

const BCRYPT_COST = 12;

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  if (!enforce(req, res, { scope: 'register', limit: 5, windowMs: 60 * 60 * 1000 })) {
    return undefined;
  }

  const { username, password, pqcPublicKey } = req.body ?? {};

  // Validated before any I/O so malformed input is rejected cheaply and does
  // not depend on the database being reachable.
  const credentialError = validateNewCredentials({ username, password });
  if (credentialError) return res.status(400).json({ error: credentialError });

  // Rejected here as well as in the schema: an over-long key would later be
  // copied into a fixed-size WASM allocation by every peer messaging this user.
  const keyError = validatePublicKey(pqcPublicKey);
  if (keyError) return res.status(400).json({ error: keyError });

  try {
    await dbConnect();

    const hashedPassword = await bcrypt.hash(password, BCRYPT_COST);

    await User.create({
      username,
      password: hashedPassword,
      pqcPublicKey: pqcPublicKey.trim(),
    });

    return res.status(201).json({ message: 'User created successfully' });
  } catch (error) {
    if (error?.code === 11000) {
      return res.status(409).json({ error: 'That username is already taken.' });
    }
    if (error?.name === 'ValidationError') {
      return res.status(400).json({ error: 'Invalid registration details.' });
    }
    console.error('Register error:', error);
    return res.status(500).json({ error: 'Registration failed. Please try again.' });
  }
}
