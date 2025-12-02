# Post-Quantum Secure Chat Application 🛡️

A full-stack, real-time messaging application secured using **Post-Quantum Cryptography (PQC)**. This project implements a **Hybrid Encryption** scheme combining **ML-KEM-512 (Kyber)** for key exchange and **AES-GCM** for message encryption, ensuring protection against both classical and future quantum threats.

## 🌟 Key Features

* **Quantum-Resistant Security:** Uses **ML-KEM-512** (NIST Standard) to negotiate shared secrets.
* **Hybrid Encryption:** Combines PQC Key Encapsulation with **AES-256-GCM** for efficient payload encryption.
* **C-Based Key Generation (WASM):** Integrates the original **`liboqs` C library** directly into the browser using **WebAssembly (Emscripten)** for key generation.
* **Real-Time Communication:** Instant messaging powered by **Socket.io**.
* **Side-Channel Protection:** Private keys are strictly held in client-side RAM and never stored in the database or cookies.
* **Persistent History:** Encrypted messages are stored in MongoDB and decrypted on-the-fly upon retrieval.

---

## 🛠️ Technical Stack

* **Frontend:** Next.js (React)
* **Backend:** Next.js API Routes (Node.js)
* **Real-Time Engine:** Socket.io
* **Database:** MongoDB
* **Cryptography:**
    * **Key Generation:** `liboqs` (C code) compiled to WebAssembly via Emscripten.
    * **Key Encapsulation:** `crystals-kyber-js` (ML-KEM-512).
    * **Symmetric Encryption:** Web Crypto API (AES-GCM).

---

## 🚀 Installation & Setup Guide

### 1. Prerequisites
Ensure you have the following installed on your system:
* [Node.js](https://nodejs.org/) (v18 or higher)
* [MongoDB Community Server](https://www.mongodb.com/try/download/community) (Ensure the service is running in the background)

sudo apt update
sudo apt install nodejs npm

sudo systemctl start mongod
sudo systemctl enable mongod

cd secure-pqc-chat-d1d60991d29901c35a7fc18087b06593d43de348

nano .env.local

# 2.Connection string for your local MongoDB
MONGODB_URI=mongodb://127.0.0.1:27017/my-chat-app

# 3.Secret key for secure sessions (change this to random characters)
JWT_SECRET=supersecretkey12345

### 4. Install Dependencies
Navigate to the project directory in your terminal and run:
```bash
npm install

### 5. 
npm run dev -- -p 3006
or
npm run dev

## Project Structure
```
my-chat-app/
├── lib/
│   ├── dbConnect.js          # MongoDB connection
│   └── pqcCrypto.js          # PQC crypto operations
├── models/
│   ├── User.js               # User model with publicKey
│   └── Message.js            # Message model with encrypted fields
├── pages/
│   ├── api/
│   │   ├── auth/
│   │   │   ├── login.js      # Login endpoint
│   │   │   └── register.js   # Registration with PQC key
│   │   ├── decrypt.js        # Decryption endpoint
│   │   ├── messages.js       # Get encrypted messages
│   │   ├── publicKey.js      # Get user's public key
│   │   └── socket.js         # WebSocket with encryption
│   ├── chat.js               # Chat page with decryption
│   ├── index.js              # Login page
│   └── register.js           # Registration page
├── temp_keys/                # Temporary directory for crypto ops
├── .env.local           
