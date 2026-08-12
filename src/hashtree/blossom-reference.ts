import { isSha256 } from "../helpers/blob.js";
import { HashtreeValidationError } from "./errors.js";

export interface BlossomReferenceExtension {
  readonly key: string;
  readonly value: string;
}

interface BlossomReferenceBase {
  readonly sha256: string;
  readonly ext: string;
  readonly servers: readonly string[];
  readonly authors: readonly string[];
  readonly size?: number;
  readonly extensions: readonly BlossomReferenceExtension[];
}

export interface PlaintextBlossomReference extends BlossomReferenceBase {
  readonly mode: "plaintext";
}

/**
 * An ordinary enumerable bearer capability. Its `key` grants decryption access,
 * so this object is unsafe for indiscriminate logging or serialization.
 */
export interface EncryptedBlossomReference extends BlossomReferenceBase {
  readonly mode: "chk-v1";
  readonly key: Uint8Array;
}

export type HashtreeBlossomReference = PlaintextBlossomReference | EncryptedBlossomReference;

const RECOGNIZED_FIELDS = new Set(["enc", "k", "xs", "as", "sz"]);
const HEX_KEY = /^[0-9a-f]{64}$/;

function invalid(message: string): never {
  throw new HashtreeValidationError(`Invalid Hashtree Blossom reference: ${message}`);
}

function validateBase(reference: HashtreeBlossomReference): void {
  if (!isSha256(reference.sha256)) invalid("sha256 must be 64 lowercase hexadecimal characters");
  if (typeof reference.ext !== "string" || reference.ext.length === 0 || /[?&#]/.test(reference.ext)) {
    invalid("ext must be a non-empty file extension");
  }
  if (!Array.isArray(reference.servers) || !reference.servers.every((value) => typeof value === "string")) {
    invalid("servers must be an array of strings");
  }
  if (!Array.isArray(reference.authors) || !reference.authors.every((value) => typeof value === "string")) {
    invalid("authors must be an array of strings");
  }
  if (reference.size !== undefined && (!Number.isSafeInteger(reference.size) || reference.size <= 0)) {
    invalid("sz must be a positive safe integer");
  }
  if (
    !Array.isArray(reference.extensions) ||
    !reference.extensions.every(
      (entry) =>
        entry !== null &&
        typeof entry === "object" &&
        typeof entry.key === "string" &&
        typeof entry.value === "string" &&
        !RECOGNIZED_FIELDS.has(entry.key),
    )
  ) {
    invalid("extensions must contain only unknown string key/value pairs");
  }
}

function decodeKey(value: string): Uint8Array {
  if (!HEX_KEY.test(value)) invalid("k must be exactly 32 bytes encoded as lowercase hexadecimal");
  return Uint8Array.from(value.match(/../g)!, (pair) => Number.parseInt(pair, 16));
}

function encodeKey(value: Uint8Array): string {
  if (!(value instanceof Uint8Array) || value.length !== 32) invalid("key must be a 32-byte Uint8Array");
  return Array.from(value, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

/** Parse an untrusted `blossom:` reference into independent plain data. */
export function parseHashtreeBlossomReference(uri: string): HashtreeBlossomReference {
  if (typeof uri !== "string" || !uri.startsWith("blossom:")) invalid("missing blossom: scheme");
  const body = uri.slice("blossom:".length);
  const queryIndex = body.indexOf("?");
  const path = queryIndex < 0 ? body : body.slice(0, queryIndex);
  const query = queryIndex < 0 ? "" : body.slice(queryIndex + 1);
  const dotIndex = path.indexOf(".");
  if (dotIndex < 0) invalid("missing file extension");

  const sha256 = path.slice(0, dotIndex);
  const ext = path.slice(dotIndex + 1);
  const params = new URLSearchParams(query);
  const encValues = params.getAll("enc");
  const keyValues = params.getAll("k");
  if (encValues.length > 1 || keyValues.length > 1) invalid("enc and k must be singletons");
  if ((encValues.length === 0) !== (keyValues.length === 0)) invalid("enc and k must appear together");
  if (encValues.length === 1 && encValues[0] !== "chk-v1") invalid("unsupported enc mode");

  const sizeValues = params.getAll("sz");
  if (sizeValues.length > 1) invalid("sz must be a singleton");
  const size = sizeValues.length === 0 ? undefined : Number(sizeValues[0]);
  const extensions = Array.from(params.entries())
    .filter(([key]) => !RECOGNIZED_FIELDS.has(key))
    .map(([key, value]) => ({ key, value }));
  const base = {
    sha256,
    ext,
    servers: [...params.getAll("xs")],
    authors: [...params.getAll("as")],
    size,
    extensions,
  };

  const reference: HashtreeBlossomReference =
    encValues.length === 0 ? { mode: "plaintext", ...base } : { mode: "chk-v1", key: decodeKey(keyValues[0]), ...base };
  validateBase(reference);
  return reference;
}

/** Build the deterministic canonical URI for a typed Blossom reference. */
export function buildHashtreeBlossomReference(reference: HashtreeBlossomReference): string {
  if (reference === null || typeof reference !== "object") invalid("reference must be an object");
  validateBase(reference);
  const params = new URLSearchParams();
  if (reference.mode === "chk-v1") {
    params.append("enc", "chk-v1");
    params.append("k", encodeKey(reference.key));
  } else if (reference.mode !== "plaintext") {
    invalid("unsupported mode");
  }
  for (const server of reference.servers) params.append("xs", server);
  for (const author of reference.authors) params.append("as", author);
  if (reference.size !== undefined) params.append("sz", String(reference.size));

  const sortedExtensions = reference.extensions
    .map((entry, index) => ({ ...entry, index }))
    .sort(
      (left, right) =>
        left.key.localeCompare(right.key) || left.value.localeCompare(right.value) || left.index - right.index,
    );
  for (const { key, value } of sortedExtensions) params.append(key, value);

  const query = params.toString();
  return `blossom:${reference.sha256}.${reference.ext}${query ? `?${query}` : ""}`;
}
