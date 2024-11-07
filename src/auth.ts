import { ServerType, UploadType } from "./client.js";
import { AUTH_EVENT_KIND } from "./const.js";
import { areServersEqual, getBlobSha256 } from "./helpers.js";
import { EventTemplate, SignedEvent, Signer } from "./types.js";

export const now = () => Math.floor(new Date().valueOf() / 1000);
export const oneHour = () => now() + 60 * 60;

export function encodeAuthorizationHeader(event: SignedEvent) {
  return "Nostr " + btoa(JSON.stringify(event));
}

/** Checks if an auth event matches a server / blob upload */
export async function doseAuthMatchUpload(auth: SignedEvent, server: ServerType, blob: UploadType) {
  const type = auth.tags.find((t) => t[0] === "t")?.[1];
  if (type !== "upload") return false;

  for (const tag of auth.tags) {
    switch (tag[0]) {
      case "x":
        if (tag[1] === (await getBlobSha256(blob))) return true;
        break;
      case "server":
        if (areServersEqual(tag[1], server)) return true;
        break;
    }
  }

  return false;
}

/**
 * Creates a GET auth event
 * @param signer the signer to use for signing the event
 * @param message A human readable explanation of what the auth token will be used for
 * @param serverOrHash A server URL or one or many blob hashes
 * @param expiration The expiration time in seconds
 * @returns {Promise<SignedEvent>}
 */
export async function createDownloadAuth(
  signer: Signer,
  serverOrHash: string | string[],
  message: string,
  expiration = oneHour(),
) {
  const draft: EventTemplate = {
    created_at: now(),
    kind: AUTH_EVENT_KIND,
    content: message,
    tags: [
      ["t", "get"],
      ["expiration", String(expiration)],
    ],
  };

  if (Array.isArray(serverOrHash)) {
    for (const sha256 of serverOrHash) draft.tags.push(["x", sha256]);
  } else if (serverOrHash.match(/^[0-9a-f]{64}$/)) {
    draft.tags.push(["x", serverOrHash]);
  } else {
    draft.tags.push(["server", new URL("/", serverOrHash).toString()]);
  }

  return await signer(draft);
}

/**
 * Creates an upload auth event
 * @param blobsOrHashes one or an array of sha256 hashes
 * @param signer the signer to use for signing the event
 * @param message A human readable explanation of what the auth token will be used for
 * @param expiration The expiration time in seconds
 * @returns {Promise<SignedEvent>}
 */
export async function createUploadAuth(
  signer: Signer,
  blobsOrHashes: string | string[] | UploadType | UploadType[],
  message = "Upload Blob",
  expiration = oneHour(),
) {
  const draft: EventTemplate = {
    kind: AUTH_EVENT_KIND,
    content: message,
    created_at: now(),
    tags: [
      ["t", "upload"],
      ["expiration", String(expiration)],
    ],
  };

  const getHash = (blob: string | UploadType) => (typeof blob === "string" ? blob : getBlobSha256(blob));

  if (Array.isArray(blobsOrHashes)) {
    for (const blob of blobsOrHashes) draft.tags.push(["x", await getHash(blob)]);
  } else {
    draft.tags.push(["x", await getHash(blobsOrHashes)]);
  }

  return await signer(draft);
}

export async function createListAuth(signer: Signer, message = "List Blobs", expiration = oneHour()) {
  return await signer({
    created_at: now(),
    kind: AUTH_EVENT_KIND,
    content: message,
    tags: [
      ["t", "list"],
      ["expiration", String(expiration)],
    ],
  });
}

export async function createDeleteAuth(
  signer: Signer,
  hash: string | string[],
  message = "Delete Blob",
  expiration = oneHour(),
) {
  const draft: EventTemplate = {
    created_at: now(),
    kind: AUTH_EVENT_KIND,
    content: message,
    tags: [
      ["t", "delete"],
      ["expiration", String(expiration)],
    ],
  };

  if (Array.isArray(hash)) {
    for (const x of hash) draft.tags.push(["x", x]);
  } else draft.tags.push(["x", hash]);

  return await signer(draft);
}
