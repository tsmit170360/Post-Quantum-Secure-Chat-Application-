import { withAuth } from '../../lib/auth';
import dbConnect from '../../lib/dbConnect';
import { isLookupableUsername } from '../../lib/validation';
import Message from '../../models/Message';

/** Newest-first page size; the client renders them oldest-first. */
const HISTORY_LIMIT = 200;

/**
 * Returns the conversation between the caller and `peer`.
 *
 * One side of the pair is always the authenticated caller, so a caller cannot
 * read a conversation they are not part of. Previously both participants came
 * from the query string, which let anyone read any conversation.
 */
async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  try {
    await dbConnect();

    const me = req.user.username;
    const { peer } = req.query;

    if (!isLookupableUsername(peer)) {
      return res.status(400).json({ error: 'A peer username is required' });
    }

    const messages = await Message.find({
      $or: [
        { sender: me, receiver: peer },
        { sender: peer, receiver: me },
      ],
    })
      .sort({ timestamp: -1 })
      .limit(HISTORY_LIMIT)
      .lean();

    return res.status(200).json(messages.reverse());
  } catch (error) {
    console.error('Fetch messages error:', error);
    return res.status(500).json({ error: 'Server error' });
  }
}

export default withAuth(handler);
