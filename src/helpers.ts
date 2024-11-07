import { bytesToHex } from "@noble/hashes/utils";

import { type UploadType } from "./client.js";
import { PaymentRequest } from "./types.js";

/** returns the last sha256 in a URL */
export function getHashFromURL(url: string | URL) {
  if (typeof url === "string") url = new URL(url);

  const hashes = Array.from(url.pathname.matchAll(/[0-9a-f]{64}/gi));
  if (hashes.length > 0) return hashes[hashes.length - 1][0];

  return null;
}

export const BlobHashSymbol = Symbol.for("blob-sha256");

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

/** Returns the mimt type of the blob */
export function getBlobType(blob: UploadType) {
  if (blob instanceof File || blob instanceof Blob) {
    return blob.type;
  }
  return undefined;
}

/** Check if two servers are the same */
export function areServersEqual(a: string | URL, b: string | URL) {
  const hostnameA = a instanceof URL ? a.hostname : new URL(a).hostname;
  const hostnameB = b instanceof URL ? b.hostname : new URL(b).hostname;
  return hostnameA === hostnameB;
}

/** Extracts a cashu-ts PaymentRequest from Headers */
export function getPaymentRequestFromHeaders(headers: Headers): PaymentRequest;
export function getPaymentRequestFromHeaders(headers: Headers, quite: false): PaymentRequest;
export function getPaymentRequestFromHeaders(headers: Headers, quite: true): PaymentRequest | undefined;
export function getPaymentRequestFromHeaders(headers: Headers, quite = false) {
  const header = headers.get("X-Cashu");
  if (!header && !quite) throw new Error("Missing cashu header");
  return header ? (JSON.parse(atob(header)) as PaymentRequest) : undefined;
}
