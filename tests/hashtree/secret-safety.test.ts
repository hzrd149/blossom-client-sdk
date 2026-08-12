import { describe, expect, it } from "vitest";
import { decryptChk, encryptChk, hashHashtreeContent } from "../../src/hashtree/chk.js";
import { createCleanError } from "./fixtures/clean-error.fixture.js";
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
});
