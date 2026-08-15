# Post-Quantum Encrypted Chat Application

A real-time chat application implementing post-quantum cryptography using Kyber-512 KEM (Key Encapsulation Mechanism) compiled to WebAssembly, combined with AES-GCM encryption for secure messaging.

## 🔐 Features

- **Post-Quantum Cryptography**: Uses Kyber-512 (liboqs `kyber_512`, the NIST round-3 candidate — see the note under Security Considerations)
- **End-to-End Encryption**: Messages encrypted client-side before transmission
- **Real-time Messaging**: WebSocket-based communication via Socket.IO
- **Hybrid Encryption**: Combines Kyber-512 KEM with AES-GCM symmetric encryption
- **WebAssembly Performance**: Cryptographic operations run via compiled C code (liboqs)
- **Persistent Storage**: MongoDB database for user accounts and encrypted messages
- **JWT Authentication**: Secure user sessions with token-based auth

## 🏗️ Architecture

### Encryption Flow

1. **Key Generation**: Users generate Kyber-512 keypairs (800-byte public key, 1632-byte private key)
2. **Registration**: Public keys stored in MongoDB, private keys remain client-side only
3. **Message Encryption**:
   - Sender retrieves recipient's public key
   - Kyber KEM generates a shared secret + ciphertext
   - AES-GCM encrypts the message using the shared secret
   - A second copy is encapsulated to the sender's own public key so they can
     re-read their own history
   - Encrypted payload sent via Socket.IO
4. **Message Decryption**:
   - Recipient uses their private key to decapsulate the shared secret
   - AES-GCM decrypts the message using the recovered secret

### Tech Stack

**Frontend:**
- Next.js (React framework)
- Tailwind CSS
- Socket.IO Client
- WebAssembly (Emscripten-compiled C code)

**Backend:**
- Node.js with Next.js API Routes
- Socket.IO Server
- MongoDB with Mongoose ODM
- bcrypt (password hashing)
- JWT (authentication)

**Cryptography:**
- liboqs (Open Quantum Safe) - Kyber-512 implementation
- WebCrypto API (AES-GCM)
- Emscripten (C to WebAssembly compilation)

## 📁 Project Structure

```
Assignment-5/
├── keygen.c                    # C implementation of Kyber-512
├── public/
│   ├── wasm_keygen.js          # Compiled WebAssembly module
│   └── wasm_keygen.wasm        # Binary WASM file
├── pages/
│   ├── _document.js            # Loads the WASM glue once, before hydration
│   ├── index.js                # Login page
│   ├── register.js             # Registration page
│   ├── chat.js                 # Main chat interface
│   ├── keygen.js               # Key generation utility page
│   └── api/
│       ├── auth/
│       │   ├── login.js        # Login endpoint
│       │   ├── logout.js       # Clears the session cookie
│       │   ├── me.js           # Returns the caller's verified identity
│       │   └── register.js     # Registration endpoint
│       ├── messages.js         # Fetch chat history
│       ├── socket.js           # Socket.IO handler
│       └── user/[username].js  # Fetch user's public key
├── models/
│   ├── User.js                 # User schema (username, password, pqcPublicKey)
│   └── Message.js              # Message schema (sender, receiver, encrypted content)
├── lib/
│   ├── auth.js                 # Token signing/verification, cookies, withAuth guard
│   ├── dbConnect.js            # MongoDB connection utility
│   ├── env.js                  # Validated environment configuration
│   ├── rateLimit.js            # In-memory rate limiter
│   └── validation.js           # Shared input validation
├── utils/
│   ├── crypto.js               # Client-side encryption/decryption functions
│   ├── hex.js                  # Strict hex encoding/decoding
│   └── pqcParams.js            # Kyber-512 parameter sizes
├── tests/                      # Vitest unit tests
└── styles/
    └── globals.css             # Global styles
```

## 🚀 Getting Started

### Prerequisites

- Node.js 16+
- MongoDB instance
- Emscripten SDK (for compiling C code, if rebuilding WASM)

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd Assignment-5
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure environment variables**

   Copy the template and fill in real values. `.env.local` is git-ignored and
   must never be committed.
   ```bash
   cp .env.example .env.local
   ```

   `JWT_SECRET` must be at least 32 characters; generate one with
   `openssl rand -hex 32`. The app fails fast with a clear message if either
   variable is missing.

4. **Run the development server**
   ```bash
   npm run dev
   ```

5. **Access the application**

   Open [http://localhost:3000](http://localhost:3000)

## 📝 Usage

### 1. Generate Keys

Navigate to `/keygen` to generate a Kyber-512 keypair:

- Public Key: 800 bytes (hex-encoded, 1600 characters)
- Private Key: 1632 bytes (hex-encoded, 3264 characters)

> ⚠️ **IMPORTANT**: Save your private key securely! It never leaves your browser.

### 2. Register

- Go to `/register`
- Enter a username (3-30 characters: letters, numbers or underscores)
- Enter a password of at least 12 characters
- Paste your public key (generated in step 1, exactly 1600 hex characters)
- Submit registration

### 3. Login

- Enter username and password
- Paste your private key when prompted
- The private key is stored in memory only for the session

### 4. Chat

- Enter recipient's username
- Type your message
- Messages are encrypted automatically before sending
- Incoming messages are decrypted automatically using your private key

## 🔧 API Endpoints

All endpoints except register and login require a valid session cookie and
return `401` without one.

### Authentication
- `POST /api/auth/register` - Create new user account (rate limited)
- `POST /api/auth/login` - Authenticate and set an HttpOnly session cookie (rate limited)
- `GET /api/auth/me` - Return the caller's verified username
- `POST /api/auth/logout` - Clear the session cookie

### Messaging
- `GET /api/messages?peer=X` - Fetch the conversation between the caller and `peer`

### User Data
- `GET /api/user/[username]` - Retrieve user's public key

### WebSocket
- `GET /api/socket` - Initialize Socket.IO connection

The handshake is authenticated from the session cookie; the connecting user's
identity and the `sender` of every message are taken from that token, never
from client-supplied values.

**Events:**
- `send_message` - Send encrypted message; acknowledged with `{ ok, id | error }`
- `receive_message` - Receive encrypted message

## 🔬 Technical Details

### Kyber-512 Parameters

- Public Key Size: 800 bytes
- Private Key Size: 1632 bytes
- Ciphertext Size: 768 bytes
- Shared Secret Size: 32 bytes

### Message Payload Structure

```json
{
  "kemCiphertext": "hex-encoded-ciphertext",
  "aesIv": "hex-encoded-iv",
  "encryptedMessage": "hex-encoded-data",
  "senderCopy": {
    "kemCiphertext": "hex-encoded-ciphertext",
    "aesIv": "hex-encoded-iv",
    "encryptedMessage": "hex-encoded-data"
  }
}
```

`senderCopy` is the same plaintext encapsulated to the sender's own public key.
It is optional: messages stored before it was introduced do not have one.

### Database Schemas

**User Model:**
```json
{
  "username": "String (unique)",
  "password": "String (bcrypt hashed)",
  "pqcPublicKey": "String (hex-encoded)"
}
```

**Message Model:**
```json
{
  "sender": "String",
  "receiver": "String",
  "content": {
    "kemCiphertext": "String",
    "aesIv": "String",
    "encryptedMessage": "String"
  },
  "timestamp": "Date"
}
```

## 🛡️ Security Considerations

### ✅ Good Practices Implemented

- Private keys never transmitted or stored server-side
- End-to-end encryption (server cannot decrypt messages)
- Quantum-resistant key exchange
- Password hashing with bcrypt (cost 12)
- Every API route and the Socket.IO handshake verify a signed session token
- Session cookie is `HttpOnly`, `SameSite=Strict`, and `Secure` in production
- Conversation history is scoped to the authenticated caller
- All key material is length-validated before entering the WebAssembly heap,
  and wiped from that heap after use
- Login and registration are rate limited

### ⚠️ Known Limitations

- This is an educational/demonstration project
- Private keys stored in browser memory only (lost on refresh)
- No secure key backup/recovery mechanism
- Transport layer security (HTTPS) required in production; the session cookie
  is only marked `Secure` when `NODE_ENV=production`
- **Algorithm naming**: this builds against liboqs `kyber_512`, the NIST round-3
  candidate, *not* the final FIPS 203 standard (`ml_kem_512`). The two are not
  interoperable. Recent liboqs releases have removed `kyber_*`, so rebuilding
  against a current liboqs requires switching to `ml_kem_512` — which
  invalidates all existing keypairs.
- **No message authentication**: the KEM provides confidentiality only. Anyone
  holding a recipient's public key can produce a valid ciphertext for them.
  Sender authenticity currently rests on the authenticated transport, not on
  the cryptography. Binding it properly needs a signature (e.g. ML-DSA).
- **No forward secrecy**: each user has one long-term static keypair, so
  compromising a private key exposes that user's entire message history.
- Usernames are case-sensitive; `Alice` and `alice` are distinct accounts.
- Socket.IO requires a long-lived Node process. It will not work on serverless
  hosts, and running multiple instances needs a shared adapter for cross-instance
  delivery.

## 🔨 Rebuilding WebAssembly

If you modify `keygen.c`:

```bash
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
  -O3 -sASSERTIONS=0 \
  -s WASM=1 \
  -s EXPORTED_FUNCTIONS='["_generate_kyber_keys","_encapsulate_kyber","_decapsulate_kyber","_get_pubkey_size","_get_privkey_size","_get_ciphertext_size","_get_shared_secret_size","_malloc","_free"]' \
  -s EXPORTED_RUNTIME_METHODS='["ccall","cwrap"]' \
  -o public/wasm_keygen.js
```

The bundled `public/wasm_keygen.wasm` is an assertions-enabled debug build.
Rebuilding with the flags above produces a smaller, faster module.

`keygen.c` returns an int status (0 = success) from each KEM wrapper. The
bundled binary predates this and returns void; the JavaScript treats an
`undefined` return as success, so it works with either build.

## 🧪 Development

```bash
npm test     # unit tests (vitest)
npm run lint # eslint
npm run build
```

## 🤝 Contributing

This is an educational project demonstrating post-quantum cryptography. Contributions welcome!

## 📄 License

MIT License - See LICENSE file for details

## 🙏 Acknowledgments

- [Open Quantum Safe (liboqs)](https://openquantumsafe.org/) - Kyber implementation
- NIST Post-Quantum Cryptography Standardization
- Emscripten team for WebAssembly tooling

---

⚡ **Built with Post-Quantum Cryptography** - Ready for the Quantum Era!
