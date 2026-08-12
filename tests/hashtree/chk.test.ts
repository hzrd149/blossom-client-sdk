import { bytesToHex } from "@noble/hashes/utils";
import { describe, expect, it } from "vitest";
import { decryptChk, encryptChk, hashHashtreeContent } from "../../src/hashtree/chk.js";

const encoder = new TextEncoder();

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
});
