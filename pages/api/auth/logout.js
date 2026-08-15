import { clearAuthCookie } from '../../../lib/auth';

/**
 * Clears the session cookie. Needed because the cookie is HttpOnly and so
 * cannot be removed by the client.
 */
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  clearAuthCookie(res);
  return res.status(200).json({ message: 'Logged out' });
}
