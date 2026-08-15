import { withAuth } from '../../../lib/auth';
import dbConnect from '../../../lib/dbConnect';
import { isLookupableUsername } from '../../../lib/validation';
import User from '../../../models/User';

/**
 * Returns a user's Kyber public key.
 *
 * Authenticated so the endpoint cannot be used for anonymous account
 * enumeration; the key itself is public by design.
 */
async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  try {
    await dbConnect();

    const { username } = req.query;
    if (!isLookupableUsername(username)) {
      return res.status(400).json({ error: 'Invalid username' });
    }

    const user = await User.findOne({ username }).select('pqcPublicKey').lean();
    if (!user) return res.status(404).json({ error: 'User not found' });

    return res.status(200).json({ pqcPublicKey: user.pqcPublicKey });
  } catch (error) {
    console.error('Fetch public key error:', error);
    return res.status(500).json({ error: 'Server error fetching key' });
  }
}

export default withAuth(handler);
