import { describe, expect, it } from "vitest";
import { finalizeEvent, generateSecretKey } from "nostr-tools";
import { bytesToHex } from "@noble/hashes/utils";

import { EventTemplate, Signer } from "../src/types.js";
import { createAuthEvent, createDownloadAuth, createMirrorAuth, doseAuthMatchUpload } from "../src/auth.js";
import { getBlobSha256 } from "../src/helpers/index.js";
import { AUTH_EVENT_KIND } from "../src";

// NOTE: patch to support node 18
const crypto = globalThis.crypto || (await import("node:crypto"));

const key = generateSecretKey();
const signer: Signer = async (t: EventTemplate) => finalizeEvent(t, key);

describe("createAuthEvent", () => {
  it("should set correct type", async () => {
    expect(await createAuthEvent(signer, "upload")).toEqual(
      expect.objectContaining({ tags: expect.arrayContaining([["t", "upload"]]) }),
    );

    expect(await createAuthEvent(signer, "delete")).toEqual(
      expect.objectContaining({ tags: expect.arrayContaining([["t", "delete"]]) }),
    );

    expect(await createAuthEvent(signer, "get")).toEqual(
      expect.objectContaining({ tags: expect.arrayContaining([["t", "get"]]) }),
    );
  });

  it("should add x tags for sha256 strings", async () => {
    const hashes = Array(2)
      .fill(0)
      .map(() => bytesToHex(crypto.getRandomValues(new Uint8Array(64))));

    expect(await createAuthEvent(signer, "upload", { blobs: hashes })).toEqual(
      expect.objectContaining({ tags: expect.arrayContaining(hashes.map((hash) => ["x", hash])) }),
    );
  });

  it("should add x tags for Blobs", async () => {
    const blobs = Array(3)
      .fill(0)
      .map(() => {
        const random = crypto.getRandomValues(new Uint8Array(128 + Math.random() * 1024));
        return new Blob([random]);
      });

    const hashes: string[] = [];
    for (const blob of blobs) hashes.push(await getBlobSha256(blob));

    expect(await createAuthEvent(signer, "upload", { blobs })).toEqual(
      expect.objectContaining({ tags: expect.arrayContaining(hashes.map((hash) => ["x", hash])) }),
    );
  });

  it.skipIf(typeof window !== "undefined")("should add x tags for Buffers", async () => {
    const { Buffer } = await import("node:buffer");

    const blobs = Array(3)
      .fill(0)
      .map(() => {
        const random = crypto.getRandomValues(new Uint8Array(128 + Math.random() * 1024));
        return Buffer.from(random);
      });

    const hashes: string[] = [];
    for (const blob of blobs) hashes.push(await getBlobSha256(blob));

    expect(await createAuthEvent(signer, "upload", { blobs })).toEqual(
      expect.objectContaining({ tags: expect.arrayContaining(hashes.map((hash) => ["x", hash])) }),
    );
  });
});

describe("createMirrorAuth", () => {
  it("should create a mirror auth event", async () => {
    const auth = await createMirrorAuth(signer, "test", { message: "Mirror Blob" });
    expect(auth).toEqual(
      expect.objectContaining({
        tags: expect.arrayContaining([["t", "upload"]]),
        content: "Mirror Blob",
      }),
    );
  });
});

describe("doseAuthMatchUpload", () => {
  it("should return false if auth event type is not upload or media", async () => {
    const auth = await createAuthEvent(signer, "list");
    const result = await doseAuthMatchUpload(auth, "https://example.com", "test-hash");
    expect(result).toBe(false);
  });

  it("should return true if blob hash matches x tag", async () => {
    const hash = "abcdef1234567890";
    const auth = await createAuthEvent(signer, "upload", { blobs: hash });
    const result = await doseAuthMatchUpload(auth, "https://example.com", hash);
    expect(result).toBe(true);
  });

  it("should return true if server matches server tag", async () => {
    const server = "https://example.com";
    const auth = await createAuthEvent(signer, "upload", { servers: server });
    const result = await doseAuthMatchUpload(auth, server, "non-matching-hash");
    expect(result).toBe(true);
  });

  it("should return false if neither blob hash nor server matches", async () => {
    const auth = await createAuthEvent(signer, "upload", {
      blobs: "some-hash",
      servers: "https://example.com",
    });
    const result = await doseAuthMatchUpload(auth, "https://different.com", "different-hash");
    expect(result).toBe(false);
  });

  it("should work with media type auth events", async () => {
    const hash = "abcdef1234567890";
    const auth = await createAuthEvent(signer, "media", { blobs: hash });
    const result = await doseAuthMatchUpload(auth, "https://example.com", hash);
    expect(result).toBe(true);
  });

  it("should handle Blob objects as input", async () => {
    const blob = new Blob(["test content"]);
    const hash = await getBlobSha256(blob);
    const auth = await createAuthEvent(signer, "upload", { blobs: hash });
    const result = await doseAuthMatchUpload(auth, "https://example.com", blob);
    expect(result).toBe(true);
  });
});

describe("createDownloadAuth", () => {
  it("should create a GET auth event with blob hash", async () => {
    const hash = "abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890";
    const auth = await createDownloadAuth(signer, hash);

    expect(auth.kind).toBe(AUTH_EVENT_KIND);
    expect(auth.tags).toContainEqual(["t", "get"]);
    expect(auth.tags).toContainEqual(["x", hash]);
    expect(auth.content).toBe("Download Blob");
  });

  it("should create a GET auth event with server URL", async () => {
    const server = "https://example.com";
    const auth = await createDownloadAuth(signer, server);

    expect(auth.kind).toBe(AUTH_EVENT_KIND);
    expect(auth.tags).toContainEqual(["t", "get"]);
    expect(auth.tags).toContainEqual(["server", server]);
    expect(auth.content).toBe("Download Blob");
  });

  it("should create a GET auth event with multiple hashes and servers", async () => {
    const hash1 = "abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890";
    const hash2 = "0987654321fedcba0987654321fedcba0987654321fedcba0987654321fedcba";
    const server1 = "https://example.com";
    const server2 = "https://example.org";

    const auth = await createDownloadAuth(signer, [hash1, hash2, server1, server2]);

    expect(auth.kind).toBe(AUTH_EVENT_KIND);
    expect(auth.tags).toContainEqual(["t", "get"]);
    expect(auth.tags).toContainEqual(["x", hash1]);
    expect(auth.tags).toContainEqual(["x", hash2]);
    expect(auth.tags).toContainEqual(["server", server1]);
    expect(auth.tags).toContainEqual(["server", server2]);
  });

  it("should create a GET auth event with Blob object", async () => {
    const blob = new Blob(["test content"]);
    const hash = await getBlobSha256(blob);

    const auth = await createDownloadAuth(signer, blob);

    expect(auth.kind).toBe(AUTH_EVENT_KIND);
    expect(auth.tags).toContainEqual(["t", "get"]);
    expect(auth.tags).toContainEqual(["x", hash]);
  });

  it("should create a GET auth event with custom message and expiration", async () => {
    const hash = "abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890";
    const customMessage = "Custom download message";
    const customExpiration = 1234567890;

    const auth = await createDownloadAuth(signer, hash, {
      message: customMessage,
      expiration: customExpiration,
    });

    expect(auth.kind).toBe(AUTH_EVENT_KIND);
    expect(auth.tags).toContainEqual(["t", "get"]);
    expect(auth.tags).toContainEqual(["x", hash]);
    expect(auth.tags).toContainEqual(["expiration", customExpiration.toString()]);
    expect(auth.content).toBe(customMessage);
  });

  it("should filter out invalid inputs", async () => {
    const hash = "abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890";
    const server = "https://example.com";
    const invalidInput = "not-a-hash-or-url";

    const auth = await createDownloadAuth(signer, [hash, server, invalidInput]);

    expect(auth.kind).toBe(AUTH_EVENT_KIND);
    expect(auth.tags).toContainEqual(["t", "get"]);
    expect(auth.tags).toContainEqual(["x", hash]);
    expect(auth.tags).toContainEqual(["server", server]);

    // The invalid input should not be included
    expect(auth.tags).not.toContainEqual(["x", invalidInput]);
    expect(auth.tags).not.toContainEqual(["server", invalidInput]);
  });
});
