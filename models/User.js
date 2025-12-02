import mongoose from 'mongoose';

const UserSchema = new mongoose.Schema({
  username: {
    type: String,
    required: [true, 'Please provide a username'],
    unique: [true, 'Username already exists'],
  },
  password: {
    type: String,
    required: [true, 'Please provide a password'],
  },
  pqcPublicKey: {
    type: String, 
    required: true 
  }
});

export default mongoose.models.User || mongoose.model('User', UserSchema);