import { describe, expect, it } from "vitest";
import { decryptChk, encryptChk, hashHashtreeContent } from "../../src/hashtree/chk.js";
import { parseHashtreeBlossomReference } from "../../src/hashtree/blossom-reference.js";
import type {
  HashtreeDiagnostic,
  HashtreeMode,
  HashtreeModeOptions,
  HashtreePublicProgress,
} from "../../src/hashtree/types.js";
import { createCleanError } from "./fixtures/clean-error.fixture.js";
import { createLeakyDiagnostic } from "./fixtures/leaky-diagnostic.fixture.js";
import { createLeakyError } from "./fixtures/leaky-error.fixture.js";

function containsSecret(value: unknown, secret: string, seen = new Set<unknown>()): boolean {
  if (typeof value === "string") return value.includes(secret);
  if ((typeof value !== "object" && typeof value !== "function") || value === null || seen.has(value)) return false;
  seen.add(value);
  return Object.getOwnPropertyNames(value).some((name) => {
    let nested: unknown;
    try {
      nested = Reflect.get(value, name);
    } catch {
      return false;
    }
    return name.includes(secret) || containsSecret(nested, secret, seen);
  });
}

describe("CHK secret safety", () => {
  it("detects a known leaky fixture and accepts a clean control", () => {
    const sentinel = "unique-secret-sentinel-9734";
    expect(containsSecret(createLeakyError(sentinel), sentinel)).toBe(true);
    expect(containsSecret(createCleanError(), sentinel)).toBe(false);
  });

  it("does not retain secrets in public integrity errors", async () => {
    const plaintext = new TextEncoder().encode("unique-secret-plaintext-6219");
    const encrypted = await encryptChk(plaintext);
    const tampered = encrypted.ciphertext.slice();
    tampered[0] ^= 1;

    let failure: unknown;
    try {
      await decryptChk(tampered, encrypted.key, hashHashtreeContent(tampered));
    } catch (error) {
      failure = error;
    }

    expect(failure).toBeInstanceOf(Error);
    expect(containsSecret(failure, "unique-secret-plaintext-6219")).toBe(false);
    expect(containsSecret(failure, Array.from(encrypted.key).join(","))).toBe(false);
    expect(JSON.stringify(failure)).toBe('{"name":"HashtreeIntegrityError"}');
  });

  it("encodes plaintext as the omitted mode default and encrypted mode explicitly", () => {
    const plaintext: HashtreeModeOptions = {};
    const explicitPlaintext: HashtreeModeOptions = { mode: "plaintext" };
    const encrypted: HashtreeModeOptions = { mode: "chk-v1" };
    const modes: HashtreeMode[] = [plaintext.mode ?? "plaintext", explicitPlaintext.mode!, encrypted.mode];
    expect(modes).toEqual(["plaintext", "plaintext", "chk-v1"]);
  });

  it("limits progress and diagnostics to public metadata while capabilities remain enumerable", () => {
    const plaintextSentinel = "unique-plaintext-sentinel-1827";
    const keyHex = "0123456789abcdef".repeat(4);
    const uriSentinel = `blossom:${"ab".repeat(32)}.bin?enc=chk-v1&k=${keyHex}`;
    const ciphertextHash = Uint8Array.from({ length: 32 }, (_, index) => index);
    const progress: HashtreePublicProgress = {
      operation: "upload",
      processedBytes: 12,
      totalBytes: 20,
      ciphertextHash: ciphertextHash.slice(),
      mode: "chk-v1",
    };
    const diagnostic: HashtreeDiagnostic = {
      operation: "decrypt",
      processedBytes: 20,
      totalBytes: 20,
      ciphertextHash: ciphertextHash.slice(),
      mode: "chk-v1",
    };

    for (const payload of [progress, diagnostic]) {
      expect(containsSecret(payload, plaintextSentinel)).toBe(false);
      expect(containsSecret(payload, keyHex)).toBe(false);
      expect(containsSecret(payload, uriSentinel)).toBe(false);
      expect(JSON.stringify(payload)).not.toContain(plaintextSentinel);
      expect(Object.keys(payload).sort()).toEqual(
        ["ciphertextHash", "mode", "operation", "processedBytes", "totalBytes"].sort(),
      );
    }

    expect(containsSecret(createLeakyDiagnostic(uriSentinel), uriSentinel)).toBe(true);
    const capability = parseHashtreeBlossomReference(uriSentinel);
    expect(Object.keys(capability)).toContain("key");
    expect(JSON.stringify(capability)).toContain("key");
  });
});

describe.runIf(typeof document === "undefined")("secret-safe public type declarations", () => {
  it("declares the mode, progress, and diagnostic contracts", async () => {
    const { readFile } = await import("node:fs/promises");
    const source = await readFile("src/hashtree/types.ts", "utf8");
    for (const declaration of ["HashtreeMode", "HashtreeModeOptions", "HashtreePublicProgress", "HashtreeDiagnostic"]) {
      expect(source).toMatch(new RegExp(`export (?:type|interface) ${declaration}`));
    }
  });
});

// @ts-expect-error progress must never accept plaintext
const leakyProgress: HashtreePublicProgress = { operation: "read", plaintext: new Uint8Array() };
// @ts-expect-error diagnostics must never accept key material
const leakyDiagnostic: HashtreeDiagnostic = { operation: "read", key: new Uint8Array(32) };
// @ts-expect-error diagnostics must never accept a complete encrypted URI
const leakyUri: HashtreeDiagnostic = { operation: "read", uri: "blossom:secret" };
// @ts-expect-error diagnostics must never accept capability-bearing references
const leakyReference: HashtreeDiagnostic = { operation: "read", reference: {} };
void [leakyProgress, leakyDiagnostic, leakyUri, leakyReference];
