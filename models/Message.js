import mongoose from 'mongoose';

const MessageSchema = new mongoose.Schema({
    sender: { 
        type: String, 
        required: true 
    },
    receiver: { 
        type: String, 
        required: true 
    },
    // --- CHANGE STARTS HERE ---
    // We replace 'text' with 'content' to store the encryption data
    content: { 
        kemCiphertext: String,    // The encapsulated key
        aesIv: String,            // The lock setting (IV)
        encryptedMessage: String  // The actual message content
    },
    // --- CHANGE ENDS HERE ---
    timestamp: { 
        type: Date, 
        default: Date.now 
    }
});

// Prevent "Model already compiled" errors in Next.js
export default mongoose.models.Message || mongoose.model('Message', MessageSchema);