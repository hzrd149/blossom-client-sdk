import { bytesToHex } from "@noble/hashes/utils";
import { hkdf } from "@noble/hashes/hkdf";
import { sha256 } from "@noble/hashes/sha2";
import { describe, expect, it } from "vitest";
import { decryptChk, encryptChk, hashHashtreeContent } from "../../src/hashtree/chk.js";
import { HashtreeIntegrityError, HashtreeValidationError } from "../../src/hashtree/errors.js";

const encoder = new TextEncoder();
const salt = encoder.encode("hashtree-chk");
const info = encoder.encode("encryption-key");

async function captureFailure(promise: Promise<unknown>): Promise<Error> {
  try {
    await promise;
    throw new Error("expected operation to fail");
  } catch (error) {
    if (!(error instanceof Error)) throw error;
    return error;
  }
}

async function encryptForKey(plaintext: Uint8Array, key: Uint8Array): Promise<Uint8Array> {
  const rawKey = new Uint8Array(hkdf(sha256, key, salt, info, 32));
  try {
    const cryptoKey = await crypto.subtle.importKey("raw", rawKey, "AES-GCM", false, ["encrypt"]);
    return new Uint8Array(
      await crypto.subtle.encrypt({ name: "AES-GCM", iv: new Uint8Array(12), tagLength: 128 }, cryptoKey, plaintext),
    );
  } finally {
    rawKey.fill(0);
  }
}

describe("CHK encryption", () => {
  it("matches the pinned BUD-15 hello vector and round-trips", async () => {
    const plaintext = encoder.encode("hello");
    const encrypted = await encryptChk(plaintext);

    expect(bytesToHex(encrypted.key)).toBe("2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824");
    expect(bytesToHex(encrypted.ciphertext)).toBe("c65308d9c8649ff1c59820d0b3a030db34ad00f92d");
    expect(encrypted.ciphertext).toHaveLength(plaintext.length + 16);

    const decrypted = await decryptChk(
      encrypted.ciphertext,
      encrypted.key,
      hashHashtreeContent(encrypted.ciphertext),
    );
    expect(decrypted).toEqual(plaintext);
  });

  it("is deterministic for identical plaintext", async () => {
    const first = await encryptChk(encoder.encode("hello"));
    const second = await encryptChk(encoder.encode("hello"));

    expect(second).toEqual(first);
    expect(second.key).not.toBe(first.key);
    expect(second.ciphertext).not.toBe(first.ciphertext);
  });

  it("matches the pinned empty-plaintext vector", async () => {
    const encrypted = await encryptChk(new Uint8Array());

    expect(bytesToHex(encrypted.key)).toBe("e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855");
    expect(bytesToHex(encrypted.ciphertext)).toBe("7cd161ae8406d82cdf553c1100d012db");
    expect(bytesToHex(hashHashtreeContent(encrypted.ciphertext))).toBe(
      "346c46e7cc6722c99efe7f7bc316d8f3ff5f025f1031bf94418ef4db891e04cd",
    );
    expect(await decryptChk(encrypted.ciphertext, encrypted.key, hashHashtreeContent(encrypted.ciphertext))).toEqual(
      new Uint8Array(),
    );
  });

  it("derives independently per exact chunk and remains stable across call order", async () => {
    const adjacent = [encoder.encode("left"), encoder.encode("right"), encoder.encode("left")];
    const ordered = await Promise.all(adjacent.map(encryptChk));
    const reversed = await Promise.all(adjacent.toReversed().map(encryptChk));

    expect(ordered[0]).toEqual(ordered[2]);
    expect(ordered[0].key).not.toEqual(ordered[1].key);
    expect(reversed.toReversed()).toEqual(ordered);
  });

  it("supports independent concurrent encryption and decryption", async () => {
    const chunks = Array.from({ length: 24 }, (_, index) => encoder.encode(`chunk-${index % 7}`));
    const encrypted = await Promise.all(chunks.map(encryptChk));
    const decrypted = await Promise.all(
      encrypted.map(({ ciphertext, key }) => decryptChk(ciphertext, key, hashHashtreeContent(ciphertext))),
    );

    expect(decrypted).toEqual(chunks);
    expect(encrypted[0]).toEqual(encrypted[7]);
  });
});

describe("CHK integrity", () => {
  it("exposes the same cause-free error for every integrity stage", async () => {
    const encrypted = await encryptChk(encoder.encode("integrity target"));
    const ciphertextHash = hashHashtreeContent(encrypted.ciphertext);

    const wrongHash = ciphertextHash.slice();
    wrongHash[0] ^= 1;

    const tamperedCiphertext = encrypted.ciphertext.slice();
    tamperedCiphertext[tamperedCiphertext.length - 1] ^= 1;

    const wrongKey = encrypted.key.slice();
    wrongKey[0] ^= 1;

    const mismatchedPlaintext = encoder.encode("authenticated but not committed");
    const mismatchedCiphertext = await encryptForKey(mismatchedPlaintext, encrypted.key);

    const errors = await Promise.all([
      captureFailure(decryptChk(encrypted.ciphertext, encrypted.key, wrongHash)),
      captureFailure(decryptChk(tamperedCiphertext, encrypted.key, hashHashtreeContent(tamperedCiphertext))),
      captureFailure(decryptChk(encrypted.ciphertext, wrongKey, ciphertextHash)),
      captureFailure(decryptChk(mismatchedCiphertext, encrypted.key, hashHashtreeContent(mismatchedCiphertext))),
    ]);

    const shapes = errors.map((error) => ({
      constructor: error.constructor,
      name: error.name,
      message: error.message,
      properties: Object.getOwnPropertyNames(error).sort(),
    }));
    expect(shapes.every((shape) => shape.constructor === HashtreeIntegrityError)).toBe(true);
    expect(shapes.slice(1)).toEqual(shapes.slice(1).map(() => shapes[0]));
    expect(errors.every((error) => !Object.hasOwn(error, "cause"))).toBe(true);
    expect(JSON.stringify(errors)).not.toMatch(/cipher|gcm|hash|key|stage|cause/i);
  });

  it("distinguishes malformed byte lengths from integrity failures", async () => {
    const encrypted = await encryptChk(encoder.encode("hello"));

    await expect(decryptChk(encrypted.ciphertext, new Uint8Array(31), new Uint8Array(32))).rejects.toBeInstanceOf(
      HashtreeValidationError,
    );
    await expect(decryptChk(encrypted.ciphertext, new Uint8Array(32), new Uint8Array(33))).rejects.toBeInstanceOf(
      HashtreeValidationError,
    );
  });
});

describe("CHK byte ownership", () => {
  it("does not mutate inputs and returns non-aliasing byte arrays", async () => {
    const plaintext = encoder.encode("caller-owned plaintext");
    const originalPlaintext = plaintext.slice();
    const encrypted = await encryptChk(plaintext);
    expect(plaintext).toEqual(originalPlaintext);

    const ciphertext = encrypted.ciphertext.slice();
    const key = encrypted.key.slice();
    const expectedHash = hashHashtreeContent(ciphertext);
    const originals = [ciphertext.slice(), key.slice(), expectedHash.slice()];
    const decrypted = await decryptChk(ciphertext, key, expectedHash);

    expect([ciphertext, key, expectedHash]).toEqual(originals);
    decrypted.fill(0);
    expect(plaintext).toEqual(originalPlaintext);
    encrypted.key.fill(0);
    encrypted.ciphertext.fill(0);
    expect(plaintext).toEqual(originalPlaintext);
  });
});
