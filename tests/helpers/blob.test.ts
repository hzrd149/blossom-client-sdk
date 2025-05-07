import { describe, expect, it } from "vitest";
import { BlobHashSymbol, computeBlobSha256, getBlobSha256, getBlobSize, getBlobType } from "../../src/helpers/blob.js";

describe("getBlobSha256", () => {
  it("should calculate the SHA-256 hash of a Blob", async () => {
    const data = new Uint8Array([1, 2, 3, 4, 5]);
    const blob = new Blob([data]);
    const hash = await getBlobSha256(blob);
    expect(hash).toBe("74f81fe167d99b4cb41d6d0ccda82278caee9f3e2f25d5e5a3936ff3dcec60d0");
  });

  it("should cache results using symbol on blob", async () => {
    const data = new Uint8Array([1, 2, 3, 4, 5]);
    const blob = new Blob([data]);

    await getBlobSha256(blob);

    expect(Reflect.get(blob, BlobHashSymbol)).toBe("74f81fe167d99b4cb41d6d0ccda82278caee9f3e2f25d5e5a3936ff3dcec60d0");
  });

  it("should return the same hash for identical content", async () => {
    const data1 = new Uint8Array([1, 2, 3, 4, 5]);
    const data2 = new Uint8Array([1, 2, 3, 4, 5]);
    const blob1 = new Blob([data1]);
    const blob2 = new Blob([data2]);

    const hash1 = await getBlobSha256(blob1);
    const hash2 = await getBlobSha256(blob2);

    expect(hash1).toBe(hash2);
  });
});

describe("computeBlobSha256", () => {
  it("should calculate the SHA-256 hash of a Blob in browser", async () => {
    const data = new Uint8Array([1, 2, 3, 4, 5]);
    const blob = new Blob([data]);
    const hash = await computeBlobSha256(blob);
    expect(hash).toBe("74f81fe167d99b4cb41d6d0ccda82278caee9f3e2f25d5e5a3936ff3dcec60d0");
  });

  it.skipIf(typeof File === "undefined")("should calculate the SHA-256 hash of a File in browser", async () => {
    const data = new Uint8Array([1, 2, 3, 4, 5, 6]);
    const file = new File([data], "test.txt");
    const hash = await computeBlobSha256(file);
    expect(hash).toBe("7192385c3c0605de55bb9476ce1d90748190ecb32a8eed7f5207b30cf6a1fe89");
  });

  it.skipIf(typeof window !== "undefined")("should calculate the SHA-256 hash of a Buffer in nodejs", async () => {
    const { Buffer } = await import("node:buffer");

    const buffer = Buffer.from([1, 2, 3, 4, 5]);
    const hash = await computeBlobSha256(buffer);
    expect(hash).toBe("74f81fe167d99b4cb41d6d0ccda82278caee9f3e2f25d5e5a3936ff3dcec60d0");
  });

  it.skipIf(typeof File === "undefined")(
    "should return the same hash for identical content across different types",
    async () => {
      const data = new Uint8Array([1, 2, 3, 4, 5]);
      const blob = new Blob([data]);
      const file = new File([data], "test.txt");

      const blobHash = await computeBlobSha256(blob);
      const fileHash = await computeBlobSha256(file);

      expect(blobHash).toBe(fileHash);
      expect(blobHash).toBe("74f81fe167d99b4cb41d6d0ccda82278caee9f3e2f25d5e5a3936ff3dcec60d0");
    },
  );

  it.skipIf(typeof File === "undefined")("should handle empty content correctly", async () => {
    const emptyBlob = new Blob([]);
    const emptyFile = new File([], "empty.txt");

    const emptyBlobHash = await computeBlobSha256(emptyBlob);
    const emptyFileHash = await computeBlobSha256(emptyFile);

    // SHA-256 of empty content
    const expectedEmptyHash = "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855";

    expect(emptyBlobHash).toBe(expectedEmptyHash);
    expect(emptyFileHash).toBe(expectedEmptyHash);
  });
});

describe("getBlobSize", () => {
  it("should return the size of a Blob", () => {
    const data = new Uint8Array([1, 2, 3, 4, 5]);
    const blob = new Blob([data]);
    expect(getBlobSize(blob)).toBe(5);
  });

  it.skipIf(typeof File === "undefined")("should return the size of a File", () => {
    const data = new Uint8Array([1, 2, 3, 4, 5, 6]);
    const file = new File([data], "test.txt");
    expect(getBlobSize(file)).toBe(6);
  });

  it.skipIf(typeof window !== "undefined")("should return the size of a Buffer in nodejs", async () => {
    const { Buffer } = await import("node:buffer");

    const buffer = Buffer.from([1, 2, 3, 4, 5, 6, 7]);
    expect(getBlobSize(buffer)).toBe(7);

    const largeBuffer = Buffer.alloc(1024);
    expect(getBlobSize(largeBuffer)).toBe(1024);
  });
});

describe("getBlobType", () => {
  it("should return the type of a Blob", () => {
    const data = new Uint8Array([1, 2, 3, 4, 5]);
    const blob = new Blob([data], { type: "application/octet-stream" });
    expect(getBlobType(blob)).toBe("application/octet-stream");
  });

  it.skipIf(typeof File === "undefined")("should return the type of a File", () => {
    const data = new Uint8Array([1, 2, 3, 4, 5]);
    const file = new File([data], "test.txt", { type: "text/plain" });
    expect(getBlobType(file)).toBe("text/plain");
  });

  it("should return empty string for Blob with no type", () => {
    const blob = new Blob(["test content"]);
    expect(getBlobType(blob)).toBe("");
  });

  it.skipIf(typeof window !== "undefined")("should return undefined for Buffer in nodejs", async () => {
    const { Buffer } = await import("node:buffer");
    const buffer = Buffer.from([1, 2, 3, 4, 5]);
    expect(getBlobType(buffer)).toBeUndefined();
  });
});
