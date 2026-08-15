import mongoose from 'mongoose';

/** One Kyber-KEM + AES-GCM envelope. */
const EnvelopeSchema = new mongoose.Schema(
  {
    kemCiphertext: { type: String, required: true },
    aesIv: { type: String, required: true },
    encryptedMessage: { type: String, required: true },
  },
  { _id: false }
);

/**
 * The recipient's envelope is stored inline (preserving the original document
 * shape), plus an optional `senderCopy` encapsulated to the sender's own public
 * key so they can re-read their own history. `senderCopy` is optional because
 * messages written before this change do not have one.
 */
const ContentSchema = new mongoose.Schema(
  {
    kemCiphertext: { type: String, required: true },
    aesIv: { type: String, required: true },
    encryptedMessage: { type: String, required: true },
    senderCopy: { type: EnvelopeSchema, default: undefined },
  },
  { _id: false }
);

const MessageSchema = new mongoose.Schema({
  sender: { type: String, required: true },
  receiver: { type: String, required: true },
  content: { type: ContentSchema, required: true },
  timestamp: { type: Date, default: Date.now },
});

// Conversation lookup is always "messages between these two people, newest
// first". Both orderings are indexed because either party can be the sender.
MessageSchema.index({ sender: 1, receiver: 1, timestamp: -1 });
MessageSchema.index({ receiver: 1, sender: 1, timestamp: -1 });

export default mongoose.models.Message || mongoose.model('Message', MessageSchema);
