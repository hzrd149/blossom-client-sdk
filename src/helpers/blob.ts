import { bytesToHex } from "@noble/hashes/utils";
import { UploadType } from "../client.js";

export function isSha256(str: string) {
  return str.match(/^[0-9a-f]{64}$/);
}

export const BlobHashSymbol = Symbol.for("sha256");

/** gets or calculates the sha2456 of a Blob */
export function getBlobSha256(blob: UploadType) {
  if (Reflect.has(blob, BlobHashSymbol)) return Reflect.get(blob, BlobHashSymbol) as string;

  return computeBlobSha256(blob).then((hash) => {
    Reflect.set(blob, BlobHashSymbol, hash);
    return hash;
  });
}

/** Calculates the sha2456 of a Blob */
export async function computeBlobSha256(blob: UploadType) {
  let buffer: ArrayBuffer;
  if (blob instanceof File || blob instanceof Blob) {
    buffer = await blob.arrayBuffer();
  } else {
    // nodejs Buffer
    buffer = blob;
  }

  let hash: Uint8Array;
  if (crypto.subtle) {
    const hashBuffer = await crypto.subtle.digest("SHA-256", buffer);
    hash = new Uint8Array(hashBuffer);
  } else {
    const { sha256 } = await import("@noble/hashes/sha256");
    hash = sha256.create().update(new Uint8Array(buffer)).digest();
  }

  return bytesToHex(hash);
}

/** Returns the size of the blob in bytes */
export function getBlobSize(blob: UploadType) {
  if (blob instanceof File || blob instanceof Blob) {
    return blob.size;
  } else {
    // nodejs Buffer
    return blob.length;
  }
}

/** Returns the mime type of the blob */
export function getBlobType(blob: UploadType) {
  if (blob instanceof File || blob instanceof Blob) {
    return blob.type;
  }
  return undefined;
}
