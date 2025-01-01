import { describe, expect, it } from "vitest";
import { finalizeEvent, generateSecretKey } from "nostr-tools";
import { bytesToHex } from "@noble/hashes/utils";

import { EventTemplate, Signer } from "../src/types.js";
import { createAuthEvent } from "../src/auth.js";
import { getBlobSha256 } from "../src/helpers.js";

const key = generateSecretKey();
const signer: Signer = async (t: EventTemplate) => finalizeEvent(t, key);

describe("create auth methods", () => {
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
});
