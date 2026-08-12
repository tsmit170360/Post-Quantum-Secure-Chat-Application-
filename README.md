Post-Quantum Encrypted Chat Application
A real-time chat application implementing post-quantum cryptography using Kyber-512 KEM (Key Encapsulation Mechanism) compiled to WebAssembly, combined with AES-GCM encryption for secure messaging.

🔐 Features
Post-Quantum Cryptography: Uses Kyber-512, a NIST-standardized quantum-resistant algorithm
End-to-End Encryption: Messages encrypted client-side before transmission
Real-time Messaging: WebSocket-based communication via Socket.IO
Hybrid Encryption: Combines Kyber-512 KEM with AES-GCM symmetric encryption
WebAssembly Performance: Cryptographic operations run via compiled C code (liboqs)
Persistent Storage: MongoDB database for user accounts and encrypted messages
JWT Authentication: Secure user sessions with token-based auth
🏗️ Architecture
Encryption Flow
Key Generation: Users generate Kyber-512 keypairs (800-byte public key, 1632-byte private key)
Registration: Public keys stored in MongoDB, private keys remain client-side only
Message Encryption:
Sender retrieves recipient's public key
Kyber KEM generates a shared secret + ciphertext
AES-GCM encrypts the message using the shared secret
Encrypted payload sent via Socket.IO
Message Decryption:
Recipient uses their private key to decapsulate the shared secret
AES-GCM decrypts the message using the recovered secret
Tech Stack
Frontend:

Next.js (React framework)
Tailwind CSS
Socket.IO Client
WebAssembly (Emscripten-compiled C code)
Backend:

Node.js with Next.js API Routes
Socket.IO Server
MongoDB with Mongoose ODM
bcrypt (password hashing)
JWT (authentication)
Cryptography:

liboqs (Open Quantum Safe) - Kyber-512 implementation
WebCrypto API (AES-GCM)
Emscripten (C to WebAssembly compilation)
📁 Project Structure
Assignment-5/
├── keygen.c                    # C implementation of Kyber-512
├── public/
│   ├── wasm_keygen.js         # Compiled WebAssembly module
│   └── wasm_keygen.wasm       # Binary WASM file
├── pages/
│   ├── index.js               # Login page
│   ├── register.js            # Registration page
│   ├── chat.js                # Main chat interface
│   ├── keygen.js              # Key generation utility page
│   └── api/
│       ├── auth/
│       │   ├── login.js       # Login endpoint
│       │   └── register.js    # Registration endpoint
│       ├── messages.js        # Fetch chat history
│       ├── messages/save.js   # Save message endpoint
│       ├── socket.js          # Socket.IO handler
│       └── user/[username].js # Fetch user's public key
├── models/
│   ├── User.js                # User schema (username, password, pqcPublicKey)
│   └── Message.js             # Message schema (sender, receiver, encrypted content)
├── lib/
│   └── dbConnect.js           # MongoDB connection utility
├── utils/
│   └── crypto.js              # Client-side encryption/decryption functions
└── styles/
    └── globals.css            # Global styles
🚀 Getting Started
Prerequisites
Node.js 16+
MongoDB instance
Emscripten SDK (for compiling C code, if rebuilding WASM)
Installation
Clone the repository
git clone <repository-url>
cd Assignment-5
Install dependencies
npm install
Configure environment variables
Create .env.local:

MONGODB_URI=mongodb://localhost:27017/pqc-chat
JWT_SECRET=your-super-secret-key-here
Run the development server
npm run dev
Access the application
http://localhost:3000
📝 Usage
1. Generate Keys
Navigate to /keygen to generate a Kyber-512 keypair:

Public Key: 800 bytes (hex-encoded, 1600 characters)
Private Key: 1632 bytes (hex-encoded, 3264 characters)
⚠️ IMPORTANT: Save your private key securely! It never leaves your browser.

2. Register
Go to /register
Enter username and password
Paste your public key (generated in step 1)
Submit registration
3. Login
Enter username and password
Paste your private key when prompted
The private key is stored in memory only for the session
4. Chat
Enter recipient's username
Type your message
Messages are encrypted automatically before sending
Incoming messages are decrypted automatically using your private key
🔧 API Endpoints
Authentication
POST /api/auth/register - Create new user account
POST /api/auth/login - Authenticate user and return JWT
Messaging
GET /api/messages?user1=X&user2=Y - Fetch chat history between two users
POST /api/messages/save - Save encrypted message (legacy, Socket.IO handles this)
User Data
GET /api/user/[username] - Retrieve user's public key
WebSocket
GET /api/socket - Initialize Socket.IO connection
Events:
send_message - Send encrypted message
receive_message - Receive encrypted message
🔬 Technical Details
Kyber-512 Parameters
Public Key Size: 800 bytes
Private Key Size: 1632 bytes
Ciphertext Size: 768 bytes
Shared Secret Size: 32 bytes
Message Payload Structure
{
  kemCiphertext: "hex-encoded-ciphertext",  // Kyber encapsulation
  aesIv: "hex-encoded-iv",                   // 12 bytes
  encryptedMessage: "hex-encoded-data"       // AES-GCM encrypted content
}
Database Schemas
User Model:

{
  username: String (unique),
  password: String (bcrypt hashed),
  pqcPublicKey: String (hex-encoded)
}
Message Model:

{
  sender: String,
  receiver: String,
  content: {
    kemCiphertext: String,
    aesIv: String,
    encryptedMessage: String
  },
  timestamp: Date
}
🛡️ Security Considerations
✅ Good Practices Implemented
Private keys never transmitted or stored server-side
End-to-end encryption (server cannot decrypt messages)
Quantum-resistant key exchange
Password hashing with bcrypt
JWT-based authentication
⚠️ Important Notes
This is an educational/demonstration project
Private keys stored in browser memory only (lost on refresh)
No secure key backup/recovery mechanism
Consider implementing secure key storage for production use
Transport layer security (HTTPS) recommended in production
🔨 Rebuilding WebAssembly
If you modify keygen.c:

# Install Emscripten
git clone https://github.com/emscripten-core/emsdk.git
cd emsdk
./emsdk install latest
./emsdk activate latest
source ./emsdk_env.sh

# Compile with liboqs
emcc keygen.c \
  -I/path/to/liboqs/include \
  -L/path/to/liboqs/lib \
  -loqs \
  -s WASM=1 \
  -s EXPORTED_FUNCTIONS='["_generate_kyber_keys","_encapsulate_kyber","_decapsulate_kyber","_get_pubkey_size","_get_privkey_size","_get_ciphertext_size","_get_shared_secret_size","_malloc","_free"]' \
  -s EXPORTED_RUNTIME_METHODS='["ccall","cwrap"]' \
  -o public/wasm_keygen.js
📚 Dependencies
{
  "next": "^15.1.3",
  "react": "^19.0.0",
  "socket.io": "^4.8.1",
  "socket.io-client": "^4.8.1",
  "mongoose": "^8.9.2",
  "bcryptjs": "^2.4.3",
  "jsonwebtoken": "^9.0.2",
  "js-cookie": "^3.0.5"
}
🤝 Contributing
This is an educational project demonstrating post-quantum cryptography. Contributions welcome!

📄 License
MIT License - See LICENSE file for details

🙏 Acknowledgments
Open Quantum Safe (liboqs) - Kyber implementation
NIST Post-Quantum Cryptography Standardization
Emscripten team for WebAssembly tooling
⚡ Built with Post-Quantum Cryptography - Ready for the Quantum Era!
