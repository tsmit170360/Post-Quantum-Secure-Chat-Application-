import { withAuth } from '../../../lib/auth';

/**
 * Returns the caller's verified identity.
 *
 * This exists so the browser never has to parse the session token itself --
 * client-side JWT decoding cannot check the signature, and needing it would
 * force the cookie to stay readable from JavaScript.
 */
async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  return res.status(200).json({ username: req.user.username });
}

export default withAuth(handler);
