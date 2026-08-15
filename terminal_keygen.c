/*
 * Standalone Kyber-512 key generator.
 *
 * Prints a keypair as lowercase hex for pasting into the web app.
 */

#include <stdio.h>
#include <stdlib.h>

#include <oqs/oqs.h>

static void print_hex(const char *label, const uint8_t *bytes, size_t length) {
    printf("\n[%s - %zu bytes]:\n", label, length);
    for (size_t i = 0; i < length; i++) {
        printf("%02x", bytes[i]);
    }
    printf("\n");
}

int main(void) {
    printf("Initializing Kyber-512...\n");

    OQS_KEM *kem = OQS_KEM_new(OQS_KEM_alg_kyber_512);
    if (kem == NULL) {
        printf("Error: Failed to initialize.\n");
        return 1;
    }

    uint8_t *public_key = malloc(kem->length_public_key);
    uint8_t *secret_key = malloc(kem->length_secret_key);
    if (public_key == NULL || secret_key == NULL) {
        printf("Error: Out of memory.\n");
        free(public_key);
        free(secret_key);
        OQS_KEM_free(kem);
        return 1;
    }

    int exit_code = 0;
    if (OQS_KEM_keypair(kem, public_key, secret_key) == OQS_SUCCESS) {
        printf("\n=== SUCCESS: KEYS GENERATED ===\n");
        print_hex("PUBLIC KEY", public_key, kem->length_public_key);
        print_hex("PRIVATE KEY", secret_key, kem->length_secret_key);
    } else {
        printf("Key generation failed.\n");
        exit_code = 1;
    }

    /* Do not leave the secret key sitting in freed heap. */
    OQS_MEM_cleanse(secret_key, kem->length_secret_key);
    free(public_key);
    free(secret_key);
    OQS_KEM_free(kem);
    return exit_code;
}
