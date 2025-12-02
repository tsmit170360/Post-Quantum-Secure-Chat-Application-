// import { MlKem512 } from 'crystals-kyber-js';

// // --- HELPER FUNCTIONS ---
// const fromHex = (hexString) => 
//   new Uint8Array(hexString.match(/.{1,2}/g).map(byte => parseInt(byte, 16)));

// const toHex = (bytes) => 
//   bytes.reduce((str, byte) => str + byte.toString(16).padStart(2, '0'), '');

// // --- 1. ENCRYPT (Sender) ---
// export async function encryptMessage(recipientPubKeyHex, messageText) {
//   try {
//     console.log("🔒 [CLIENT-SIDE ENCRYPTION START]");
//     console.log("   Original Message:", messageText);
    
//     const pubKeyBytes = fromHex(recipientPubKeyHex);

//     // KEM Encapsulation
//     console.log("   Step 1: Generating Shared Secret using Kyber-512 (KEM)...");
//     const sender = new MlKem512();
//     const [ciphertext, sharedSecret] = await sender.encap(pubKeyBytes);
//     console.log("   --> Shared Secret Generated (Client-Only):", toHex(new Uint8Array(sharedSecret)).substring(0, 20) + "...");

//     // AES Encryption
//     console.log("   Step 2: Encrypting text with AES-GCM using Shared Secret...");
//     const aesKey = await window.crypto.subtle.importKey(
//         "raw", sharedSecret, "AES-GCM", false, ["encrypt"]
//     );

//     const iv = window.crypto.getRandomValues(new Uint8Array(12));
//     const encodedMsg = new TextEncoder().encode(messageText);

//     const encryptedContent = await window.crypto.subtle.encrypt(
//         { name: "AES-GCM", iv: iv }, aesKey, encodedMsg
//     );
    
//     console.log("   --> Encryption Complete. Ciphertext ready to send.");
//     console.log("🔒 [CLIENT-SIDE ENCRYPTION END]");

//     return {
//         kemCiphertext: toHex(ciphertext),
//         aesIv: toHex(iv),
//         encryptedMessage: toHex(new Uint8Array(encryptedContent))
//     };
//   } catch (err) {
//     console.error("Encryption Failed:", err);
//     throw new Error("PQC Encryption failed. Check keys.");
//   }
// }

// // --- 2. DECRYPT (Receiver) ---
// export async function decryptMessage(payload, myPrivateKeyHex) {
//   try {
//     console.log("🔓 [CLIENT-SIDE DECRYPTION START]");
//     console.log("   Received Encrypted Payload:", payload.encryptedMessage.substring(0, 20) + "...");

//     const { kemCiphertext, aesIv, encryptedMessage } = payload;
//     const privKeyBytes = fromHex(myPrivateKeyHex);
//     const ciphertextBytes = fromHex(kemCiphertext);

//     // KEM Decapsulation
//     console.log("   Step 1: Recovering Shared Secret using Kyber-512 (KEM)...");
//     const recipient = new MlKem512();
//     const sharedSecret = await recipient.decap(ciphertextBytes, privKeyBytes);
//     console.log("   --> Shared Secret Recovered:", toHex(new Uint8Array(sharedSecret)).substring(0, 20) + "...");

//     // AES Decryption
//     console.log("   Step 2: Decrypting AES-GCM payload...");
//     const aesKey = await window.crypto.subtle.importKey(
//         "raw", sharedSecret, "AES-GCM", false, ["decrypt"]
//     );

//     const decryptedBuffer = await window.crypto.subtle.decrypt(
//         { name: "AES-GCM", iv: fromHex(aesIv) },
//         aesKey,
//         fromHex(encryptedMessage)
//     );

//     const originalText = new TextDecoder().decode(decryptedBuffer);
//     console.log("   --> Decryption Successful. Message recovered.");
//     console.log("   Decrypted Text:", originalText);
//     console.log("🔓 [CLIENT-SIDE DECRYPTION END]");

//     return originalText;
//   } catch (err) {
//     console.error("Decryption Failed:", err);
//     throw err;
//   }
// }


// Remove the old JS library import
// import { MlKem512 } from 'crystals-kyber-js'; 

// Helper: Convert Hex to Uint8Array
const fromHex = (hexString) => 
  new Uint8Array(hexString.match(/.{1,2}/g).map(byte => parseInt(byte, 16)));

// Helper: Convert Uint8Array to Hex
const toHex = (bytes) => 
  bytes.reduce((str, byte) => str + byte.toString(16).padStart(2, '0'), '');

// Helper to ensure WASM is ready
const getWasmModule = async () => {
    if (typeof window !== 'undefined' && window.Module && window.Module.onRuntimeInitialized) {
        return window.Module;
    }
    // Simple polling wait if not ready yet
    return new Promise((resolve) => {
        const check = setInterval(() => {
            if (window.Module && window.Module._malloc) { // Check for a known function
                clearInterval(check);
                resolve(window.Module);
            }
        }, 100);
    });
};

// --- 1. ENCRYPT (Using C Code) ---
export async function encryptMessage(recipientPubKeyHex, messageText) {
  try {
    const Module = await getWasmModule();
    console.log("🔒 [C-WASM] Encrypting...");

    // 1. Prepare Data
    const pubKeyBytes = fromHex(recipientPubKeyHex);
    
    // 2. Allocate Memory in C
    const pkSize = Module._get_pubkey_size();
    const ctSize = Module._get_ciphertext_size();
    const ssSize = Module._get_shared_secret_size();

    const pkPtr = Module._malloc(pkSize);
    const ctPtr = Module._malloc(ctSize);
    const ssPtr = Module._malloc(ssSize);

    // 3. Copy Public Key to C Memory
    Module.HEAPU8.set(pubKeyBytes, pkPtr);

    // 4. CALL C FUNCTION: encapsulate_kyber(ct, ss, pk)
    Module._encapsulate_kyber(ctPtr, ssPtr, pkPtr);

    // 5. Read Result (Ciphertext & Shared Secret)
    const ciphertextBytes = new Uint8Array(Module.HEAPU8.buffer, ctPtr, ctSize);
    const sharedSecretBytes = new Uint8Array(Module.HEAPU8.buffer, ssPtr, ssSize);

    // Copy to JS memory (because we are about to free C memory)
    const sharedSecret = new Uint8Array(sharedSecretBytes);
    const ciphertextHex = toHex(ciphertextBytes);

    // 6. Free C Memory
    Module._free(pkPtr);
    Module._free(ctPtr);
    Module._free(ssPtr);

    // 7. AES Encryption (Standard JS WebCrypto)
    const aesKey = await window.crypto.subtle.importKey(
        "raw", sharedSecret, "AES-GCM", false, ["encrypt"]
    );

    const iv = window.crypto.getRandomValues(new Uint8Array(12));
    const encodedMsg = new TextEncoder().encode(messageText);

    const encryptedContent = await window.crypto.subtle.encrypt(
        { name: "AES-GCM", iv: iv }, aesKey, encodedMsg
    );

    console.log("🔒 [C-WASM] Encryption Complete.");

    return {
        kemCiphertext: ciphertextHex,
        aesIv: toHex(iv),
        encryptedMessage: toHex(new Uint8Array(encryptedContent))
    };

  } catch (err) {
    console.error("WASM Encryption Failed:", err);
    throw new Error("WASM PQC Encryption failed.");
  }
}

// --- 2. DECRYPT (Using C Code) ---
export async function decryptMessage(payload, myPrivateKeyHex) {
  try {
    const Module = await getWasmModule();
    console.log("🔓 [C-WASM] Decrypting...");

    const { kemCiphertext, aesIv, encryptedMessage } = payload;
    const privKeyBytes = fromHex(myPrivateKeyHex);
    const ciphertextBytes = fromHex(kemCiphertext);

    // 1. Allocate Memory in C
    const skSize = Module._get_privkey_size();
    const ctSize = Module._get_ciphertext_size();
    const ssSize = Module._get_shared_secret_size();

    const skPtr = Module._malloc(skSize);
    const ctPtr = Module._malloc(ctSize);
    const ssPtr = Module._malloc(ssSize);

    // 2. Copy Data to C Memory
    Module.HEAPU8.set(privKeyBytes, skPtr);
    Module.HEAPU8.set(ciphertextBytes, ctPtr);

    // 3. CALL C FUNCTION: decapsulate_kyber(ss, ct, sk)
    Module._decapsulate_kyber(ssPtr, ctPtr, skPtr);

    // 4. Read Shared Secret
    const sharedSecretBytes = new Uint8Array(Module.HEAPU8.buffer, ssPtr, ssSize);
    const sharedSecret = new Uint8Array(sharedSecretBytes); // Copy

    // 5. Free C Memory
    Module._free(skPtr);
    Module._free(ctPtr);
    Module._free(ssPtr);

    // 6. AES Decryption
    const aesKey = await window.crypto.subtle.importKey(
        "raw", sharedSecret, "AES-GCM", false, ["decrypt"]
    );

    const decryptedBuffer = await window.crypto.subtle.decrypt(
        { name: "AES-GCM", iv: fromHex(aesIv) },
        aesKey,
        fromHex(encryptedMessage)
    );

    return new TextDecoder().decode(decryptedBuffer);

  } catch (err) {
    console.error("WASM Decryption Failed:", err);
    throw err;
  }
}