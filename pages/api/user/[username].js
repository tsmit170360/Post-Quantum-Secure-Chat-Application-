import dbConnect from '../../../lib/dbConnect'; // Update path if needed (e.g., lib/dbConnect)
import User from '../../../models/User';

export default async function handler(req, res) {
  const { username } = req.query;

  if (req.method !== 'GET') return res.status(405).end();

  try {
    await dbConnect();
    // Find user and ONLY return the public key (exclude password)
    const user = await User.findOne({ username }).select('pqcPublicKey');

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.status(200).json({ pqcPublicKey: user.pqcPublicKey });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error fetching key' });
  }
}