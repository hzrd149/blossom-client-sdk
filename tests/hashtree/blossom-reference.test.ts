import { describe, expect, it } from "vitest";
import {
  buildHashtreeBlossomReference,
  parseHashtreeBlossomReference,
  type EncryptedBlossomReference,
} from "../../src/hashtree/blossom-reference.js";
import { HashtreeValidationError } from "../../src/hashtree/errors.js";

const HASH = "b1674191a88ec5cdd733e4240a81803105dc412d6c6708d53ab94fc248f4f553";
const KEY = "0123456789abcdef".repeat(4);
const encrypted = `blossom:${HASH}.bin?enc=chk-v1&k=${KEY}`;

describe("parseHashtreeBlossomReference", () => {
  it("parses plaintext metadata and encrypted bearer capabilities into independent data", () => {
    const plaintext = parseHashtreeBlossomReference(
      `blossom:${HASH}.txt?xs=https%3A%2F%2Fa.example&xs=b&as=author&sz=17&z=last&x=&x=again`,
    );
    expect(plaintext).toEqual({
      mode: "plaintext",
      sha256: HASH,
      ext: "txt",
      servers: ["https://a.example", "b"],
      authors: ["author"],
      size: 17,
      extensions: [
        { key: "z", value: "last" },
        { key: "x", value: "" },
        { key: "x", value: "again" },
      ],
    });

    const parsed = parseHashtreeBlossomReference(encrypted) as EncryptedBlossomReference;
    expect(parsed.mode).toBe("chk-v1");
    expect(Array.from(parsed.key)).toEqual(Array.from(Uint8Array.from(KEY.match(/../g)!, (hex) => Number.parseInt(hex, 16))));
    expect(Object.keys(parsed)).toContain("key");
    const first = parsed.key[0];
    parsed.key[0] ^= 0xff;
    expect((parseHashtreeBlossomReference(encrypted) as EncryptedBlossomReference).key[0]).toBe(first);
  });

  it.each([
    `blossom:${HASH}.bin?enc=chk-v1`,
    `blossom:${HASH}.bin?k=${KEY}`,
    `blossom:${HASH}.bin?enc=other&k=${KEY}`,
    `blossom:${HASH}.bin?enc=chk-v1&enc=chk-v1&k=${KEY}`,
    `blossom:${HASH}.bin?enc=chk-v1&enc=other&k=${KEY}`,
    `blossom:${HASH}.bin?enc=chk-v1&k=${KEY}&k=${KEY}`,
    `blossom:${HASH}.bin?enc=chk-v1&k=${KEY.toUpperCase()}`,
    `blossom:${HASH}.bin?enc=chk-v1&k=abcd`,
    `blossom:${HASH}.bin?enc=chk-v1&k=${"g".repeat(64)}`,
  ])("rejects ambiguous or invalid security fields: %s", (uri) => {
    expect(() => parseHashtreeBlossomReference(uri)).toThrow(HashtreeValidationError);
  });
});

describe("buildHashtreeBlossomReference", () => {
  it("canonicalizes recognized fields, repeated extensions, percent encoding, and stable ties", () => {
    const parsed = parseHashtreeBlossomReference(
      `blossom:${HASH}.bin?z=2&xs=one&k=${KEY}&a=%2F&enc=chk-v1&as=author&sz=9&a=&xs=two&a=%2F`,
    );
    expect(buildHashtreeBlossomReference(parsed)).toBe(
      `blossom:${HASH}.bin?enc=chk-v1&k=${KEY}&xs=one&xs=two&as=author&sz=9&a=&a=%2F&a=%2F&z=2`,
    );
  });

  it("is idempotent and pure across repeated and concurrent parse/build calls", async () => {
    const noncanonical = `blossom:${HASH}.bin?b=2&enc=chk-v1&k=${KEY}&a=1&a=&xs=s`;
    const canonical = buildHashtreeBlossomReference(parseHashtreeBlossomReference(noncanonical));
    expect(buildHashtreeBlossomReference(parseHashtreeBlossomReference(canonical))).toBe(canonical);
    const results = await Promise.all(
      Array.from({ length: 20 }, async () => buildHashtreeBlossomReference(parseHashtreeBlossomReference(noncanonical))),
    );
    expect(new Set(results)).toEqual(new Set([canonical]));
  });

  it("validates builder inputs symmetrically and copies key bytes", () => {
    const key = Uint8Array.from(KEY.match(/../g)!, (hex) => Number.parseInt(hex, 16));
    const reference: EncryptedBlossomReference = {
      mode: "chk-v1",
      sha256: HASH,
      ext: "bin",
      servers: [],
      authors: [],
      extensions: [],
      key,
    };
    expect(buildHashtreeBlossomReference(reference)).toBe(encrypted);
    key.fill(255);
    expect(buildHashtreeBlossomReference(parseHashtreeBlossomReference(encrypted))).toBe(encrypted);
    expect(() => buildHashtreeBlossomReference({ ...reference, key: new Uint8Array(31) })).toThrow(
      HashtreeValidationError,
    );
    expect(() => buildHashtreeBlossomReference({ ...reference, sha256: "bad" })).toThrow(HashtreeValidationError);
    expect(() => buildHashtreeBlossomReference({ ...reference, extensions: [{ key: "enc", value: "other" }] })).toThrow(
      HashtreeValidationError,
    );
  });
});
