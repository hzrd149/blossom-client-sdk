import { hkdf } from "@noble/hashes/hkdf";
import { sha256 } from "@noble/hashes/sha2";
import { HashtreeIntegrityError, HashtreeValidationError } from "./errors.js";

const encoder = new TextEncoder();
const CHK_SALT = encoder.encode("hashtree-chk");
const CHK_INFO = encoder.encode("encryption-key");
const ZERO_NONCE = new Uint8Array(12);
const KEY_LENGTH = 32;
const INTEGRITY_MESSAGE = "Hashtree content failed integrity verification";

function copyBytes(input: Uint8Array): Uint8Array<ArrayBuffer> {
  return new Uint8Array(input);
}

function equalBytes(left: Uint8Array, right: Uint8Array): boolean {
  if (left.length !== right.length) return false;

  let difference = 0;
  for (let index = 0; index < left.length; index++) difference |= left[index] ^ right[index];
  return difference === 0;
}

function validateLength(value: Uint8Array, name: string): void {
  if (!(value instanceof Uint8Array) || value.length !== KEY_LENGTH) {
    throw new HashtreeValidationError(`${name} must be a 32-byte Uint8Array`);
  }
}

function integrityError(): HashtreeIntegrityError {
  return new HashtreeIntegrityError(INTEGRITY_MESSAGE);
}

/** Hash bytes for use as a Hashtree content key or content address. */
export function hashHashtreeContent(input: Uint8Array): Uint8Array {
  if (!(input instanceof Uint8Array)) throw new HashtreeValidationError("input must be a Uint8Array");
  return copyBytes(sha256(copyBytes(input)));
}

/** Deterministically encrypt one plaintext chunk using BUD-15 chk-v1. */
export async function encryptChk(
  plaintext: Uint8Array,
): Promise<{ ciphertext: Uint8Array; key: Uint8Array }> {
  if (!(plaintext instanceof Uint8Array)) throw new HashtreeValidationError("plaintext must be a Uint8Array");

  const plaintextCopy = copyBytes(plaintext);
  const key = hashHashtreeContent(plaintextCopy);
  const aesKey = copyBytes(hkdf(sha256, key, CHK_SALT, CHK_INFO, KEY_LENGTH));
  try {
    const importedKey = await crypto.subtle.importKey("raw", aesKey, "AES-GCM", false, ["encrypt"]);
    const encrypted = await crypto.subtle.encrypt(
      { name: "AES-GCM", iv: ZERO_NONCE, tagLength: 128 },
      importedKey,
      plaintextCopy,
    );
    return { ciphertext: new Uint8Array(encrypted), key: copyBytes(key) };
  } finally {
    aesKey.fill(0);
  }
}

/** Verify and decrypt one BUD-15 chk-v1 ciphertext chunk. */
export async function decryptChk(
  ciphertext: Uint8Array,
  key: Uint8Array,
  expectedCiphertextHash: Uint8Array,
): Promise<Uint8Array> {
  if (!(ciphertext instanceof Uint8Array)) throw new HashtreeValidationError("ciphertext must be a Uint8Array");
  validateLength(key, "key");
  validateLength(expectedCiphertextHash, "expectedCiphertextHash");

  const ciphertextCopy = copyBytes(ciphertext);
  const keyCopy = copyBytes(key);
  const hashCopy = copyBytes(expectedCiphertextHash);
  if (!equalBytes(hashHashtreeContent(ciphertextCopy), hashCopy)) throw integrityError();

  const aesKey = copyBytes(hkdf(sha256, keyCopy, CHK_SALT, CHK_INFO, KEY_LENGTH));
  try {
    let plaintext: Uint8Array;
    try {
      const importedKey = await crypto.subtle.importKey("raw", aesKey, "AES-GCM", false, ["decrypt"]);
      const decrypted = await crypto.subtle.decrypt(
        { name: "AES-GCM", iv: ZERO_NONCE, tagLength: 128 },
        importedKey,
        ciphertextCopy,
      );
      plaintext = new Uint8Array(decrypted);
    } catch {
      throw integrityError();
    }

    if (!equalBytes(hashHashtreeContent(plaintext), keyCopy)) throw integrityError();
    return copyBytes(plaintext);
  } finally {
    aesKey.fill(0);
    keyCopy.fill(0);
  }
}
