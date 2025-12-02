import dbConnect from '../../../lib/dbConnect';
import Message from '../../../models/Message';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    await dbConnect();

    const { sender, receiver, text, timestamp } = req.body;

    if (!sender || !receiver || !text) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    // Create new message in database
    const newMessage = await Message.create({
      sender,
      receiver,
      text,
      timestamp: timestamp || new Date()
    });

    res.status(201).json({ 
      message: 'Message saved successfully',
      data: newMessage 
    });

  } catch (error) {
    console.error('Error saving message:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
}