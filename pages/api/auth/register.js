import dbConnect from '../../../lib/dbConnect'; // Check if your folder is named 'utils' or 'lib'
import User from '../../../models/User';
import bcrypt from 'bcryptjs';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  try {
    await dbConnect();
    // 1. Accept pqcPublicKey from the request body
    const { username, password, pqcPublicKey } = req.body;

    if (!username || !password || !pqcPublicKey) {
      return res.status(400).json({ error: 'Username, Password, and Public Key are required' });
    }

    // 2. Hash password
    const hashedPassword = await bcrypt.hash(password, 12);

    // 3. Create user with the Public Key
    const newUser = await User.create({
      username,
      password: hashedPassword,
      pqcPublicKey 
    });

    res.status(201).json({ message: 'User created successfully' });
  } catch (error) {
    console.error("Register Error:", error);
    res.status(500).json({ error: 'Registration failed (Username might be taken)' });
  }
}