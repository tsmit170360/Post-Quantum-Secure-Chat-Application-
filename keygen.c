/*
 * Kyber-512 wrappers exposed to JavaScript through Emscripten.
 *
 * All three operations return an int status (0 = success) so that a failure in
 * liboqs cannot be mistaken for success by the caller. Previously they were
 * `void`, so a failed OQS_KEM_new left the caller reading uninitialised heap as
 * if it were key material.
 *
 * Rebuild with:
 *   emcc keygen.c -I<liboqs>/include -L<liboqs>/lib -loqs -O3 -sASSERTIONS=0 \
 *     -sEXPORTED_FUNCTIONS='["_generate_kyber_keys","_encapsulate_kyber",\
 *       "_decapsulate_kyber","_get_pubkey_size","_get_privkey_size",\
 *       "_get_ciphertext_size","_get_shared_secret_size","_malloc","_free"]' \
 *     -sEXPORTED_RUNTIME_METHODS='["ccall","cwrap"]' -o public/wasm_keygen.js
 */

#include <stdint.h>
#include <stdlib.h>

#include <emscripten.h>
#include <oqs/oqs.h>

#define KEM_ALGORITHM OQS_KEM_alg_kyber_512

#define STATUS_OK 0
#define STATUS_KEM_UNAVAILABLE (-1)
#define STATUS_OPERATION_FAILED (-2)

/*
 * A single KEM instance is reused for every call. WebAssembly is
 * single-threaded here, so this is safe, and it avoids allocating and freeing
 * an OQS_KEM for every message.
 */
static OQS_KEM *kem_instance = NULL;

static OQS_KEM *get_kem(void) {
    if (kem_instance == NULL) {
        kem_instance = OQS_KEM_new(KEM_ALGORITHM);
    }
    return kem_instance;
}

EMSCRIPTEN_KEEPALIVE
int generate_kyber_keys(uint8_t *public_key, uint8_t *secret_key) {
    OQS_KEM *kem = get_kem();
    if (kem == NULL) return STATUS_KEM_UNAVAILABLE;

    if (OQS_KEM_keypair(kem, public_key, secret_key) != OQS_SUCCESS) {
        return STATUS_OPERATION_FAILED;
    }
    return STATUS_OK;
}

EMSCRIPTEN_KEEPALIVE
int encapsulate_kyber(uint8_t *ciphertext, uint8_t *shared_secret, const uint8_t *public_key) {
    OQS_KEM *kem = get_kem();
    if (kem == NULL) return STATUS_KEM_UNAVAILABLE;

    if (OQS_KEM_encaps(kem, ciphertext, shared_secret, public_key) != OQS_SUCCESS) {
        return STATUS_OPERATION_FAILED;
    }
    return STATUS_OK;
}

EMSCRIPTEN_KEEPALIVE
int decapsulate_kyber(uint8_t *shared_secret, const uint8_t *ciphertext, const uint8_t *secret_key) {
    OQS_KEM *kem = get_kem();
    if (kem == NULL) return STATUS_KEM_UNAVAILABLE;

    if (OQS_KEM_decaps(kem, shared_secret, ciphertext, secret_key) != OQS_SUCCESS) {
        return STATUS_OPERATION_FAILED;
    }
    return STATUS_OK;
}

/*
 * Buffer sizes are read from the KEM itself rather than hardcoded, so they stay
 * correct if the algorithm is ever changed. A zero return means the KEM is
 * unavailable; the JavaScript side validates these against its expected values.
 */
EMSCRIPTEN_KEEPALIVE
int get_pubkey_size(void) {
    OQS_KEM *kem = get_kem();
    return kem ? (int)kem->length_public_key : 0;
}

EMSCRIPTEN_KEEPALIVE
int get_privkey_size(void) {
    OQS_KEM *kem = get_kem();
    return kem ? (int)kem->length_secret_key : 0;
}

EMSCRIPTEN_KEEPALIVE
int get_ciphertext_size(void) {
    OQS_KEM *kem = get_kem();
    return kem ? (int)kem->length_ciphertext : 0;
}

EMSCRIPTEN_KEEPALIVE
int get_shared_secret_size(void) {
    OQS_KEM *kem = get_kem();
    return kem ? (int)kem->length_shared_secret : 0;
}
