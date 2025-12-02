// FIX: Change 'utils' to 'lib' (based on your file structure)
import dbConnect from '../../lib/dbConnect'; 
import Message from '../../models/Message';

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end();

  try {
    await dbConnect();
    const { user1, user2 } = req.query;

    if (!user1 || !user2) return res.status(400).json({ error: 'Missing users' });

    // Fetch and Sort
    const messages = await Message.find({
      $or: [
        { sender: user1, receiver: user2 },
        { sender: user2, receiver: user1 }
      ]
    }).sort({ timestamp: 1 });

    res.status(200).json(messages);
  } catch (error) {
    console.error("Fetch Error:", error);
    res.status(500).json({ error: 'Server Error' });
  }
}