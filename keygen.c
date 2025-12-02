// #include <stdio.h>
// #include <stdlib.h>
// #include <string.h>
// #include <oqs/oqs.h>
// #include <emscripten.h> 

// // 1. Function to Generate Keys (Called from JS)
// EMSCRIPTEN_KEEPALIVE
// void generate_kyber_keys(uint8_t *public_key, uint8_t *secret_key) {
//     // Initialize Kyber-512
//     OQS_KEM *kem = OQS_KEM_new(OQS_KEM_alg_kyber_512);
//     if (kem == NULL) return;

//     // Generate keys directly into the memory JavaScript gave us
//     OQS_KEM_keypair(kem, public_key, secret_key);

//     // Cleanup
//     OQS_KEM_free(kem);
// }

// // 2. Helper: Tell JS the Public Key size is 800 bytes
// EMSCRIPTEN_KEEPALIVE
// int get_pubkey_size() {
//     return 800; 
// }

// // 3. Helper: Tell JS the Private Key size is 1632 bytes
// EMSCRIPTEN_KEEPALIVE
// int get_privkey_size() {
//     return 1632; 
// }

//---------
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <oqs/oqs.h>
#include <emscripten.h> 

// Constants for Kyber-512
// We define them here so we can use them in multiple functions safely
#define KYBER_PUBKEY_SIZE 800
#define KYBER_PRIVKEY_SIZE 1632
#define KYBER_CIPHERTEXT_SIZE 768
#define KYBER_SHARED_SECRET_SIZE 32

// --- 1. KEY GENERATION (This is the code you provided) ---
EMSCRIPTEN_KEEPALIVE
void generate_kyber_keys(uint8_t *public_key, uint8_t *secret_key) {
    // Initialize Kyber-512
    OQS_KEM *kem = OQS_KEM_new(OQS_KEM_alg_kyber_512);
    if (kem == NULL) return;

    // Generate keys directly into the memory pointers provided by JS
    OQS_KEM_keypair(kem, public_key, secret_key);

    // Cleanup
    OQS_KEM_free(kem);
}

// --- 2. ENCAPSULATION (Encryption) ---
// This function generates the Shared Secret and the Ciphertext using the Receiver's Public Key
EMSCRIPTEN_KEEPALIVE
void encapsulate_kyber(uint8_t *ciphertext, uint8_t *shared_secret, uint8_t *public_key) {
    OQS_KEM *kem = OQS_KEM_new(OQS_KEM_alg_kyber_512);
    if (kem == NULL) return;
    
    OQS_KEM_encaps(kem, ciphertext, shared_secret, public_key);
    
    OQS_KEM_free(kem);
}

// --- 3. DECAPSULATION (Decryption) ---
// This function recovers the Shared Secret using the Receiver's Private Key
EMSCRIPTEN_KEEPALIVE
void decapsulate_kyber(uint8_t *shared_secret, uint8_t *ciphertext, uint8_t *secret_key) {
    OQS_KEM *kem = OQS_KEM_new(OQS_KEM_alg_kyber_512);
    if (kem == NULL) return;
    
    OQS_KEM_decaps(kem, shared_secret, ciphertext, secret_key);
    
    OQS_KEM_free(kem);
}

// --- 4. MEMORY SIZE HELPERS ---
// JS needs to know how much memory to allocate for each operation
EMSCRIPTEN_KEEPALIVE int get_pubkey_size() { return KYBER_PUBKEY_SIZE; }
EMSCRIPTEN_KEEPALIVE int get_privkey_size() { return KYBER_PRIVKEY_SIZE; }
EMSCRIPTEN_KEEPALIVE int get_ciphertext_size() { return KYBER_CIPHERTEXT_SIZE; }
EMSCRIPTEN_KEEPALIVE int get_shared_secret_size() { return KYBER_SHARED_SECRET_SIZE; }