import { ServerType, UploadType } from "./types.js";
import { AUTH_EVENT_KIND } from "./const.js";
import { getBlobSha256, isSha256 } from "./helpers/blob.js";
import { areServersEqual, getServerHostname } from "./helpers/url.js";
import { EventTemplate, SignedEvent, Signer } from "./types.js";

export const now = () => Math.floor(new Date().valueOf() / 1000);
export const oneHour = () => now() + 60 * 60;

export type AuthRequest = {
  server: ServerType;
  type: AuthType;
  blob?: string | UploadType;
};

/** Encodes an auth event into a nostr authorization header */
export function encodeAuthorizationHeader(event: SignedEvent) {
  const json = JSON.stringify(event);
  const bytes = new TextEncoder().encode(json);
  let binary = "";

  for (const byte of bytes) binary += String.fromCharCode(byte);

  return "Nostr " + btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

/** Checks if an auth event matches a server / blob upload */
export async function doseAuthMatchBlob(
  auth: SignedEvent,
  server: ServerType,
  blob: string | UploadType,
  type: string = "upload",
) {
  if (type !== "upload" && type !== "media") return false;
  return doesAuthMatchRequest(auth, { server, type, blob });
}

/** Returns all tag values for a specific tag name */
export function getAuthTagValues(auth: SignedEvent, tagName: string) {
  return auth.tags.filter((tag) => tag[0] === tagName).map((tag) => tag[1]);
}

/** Returns the auth event expiration timestamp if one exists */
export function getAuthExpiration(auth: SignedEvent) {
  const expiration = auth.tags.find((tag) => tag[0] === "expiration")?.[1];
  if (!expiration) return undefined;

  const timestamp = Number(expiration);
  if (!Number.isFinite(timestamp)) return undefined;

  return timestamp;
}

/** Returns true if an auth event has expired */
export function isAuthExpired(auth: SignedEvent, timestamp: number = now()) {
  const expiration = getAuthExpiration(auth);
  return expiration !== undefined && expiration <= timestamp;
}

/** Normalizes a server tag value to a lowercase hostname */
export function normalizeServerTag(server: string | URL) {
  return getServerHostname(server);
}

function requestRequiresHashTag(type: AuthType) {
  return type === "upload" || type === "media" || type === "delete";
}

/** Checks if an auth event can be reused for a request */
export async function doesAuthMatchRequest(auth: SignedEvent, request: AuthRequest) {
  if (isAuthExpired(auth)) return false;

  const authType = auth.tags.find((tag) => tag[0] === "t")?.[1];
  if (authType !== request.type) return false;

  const serverTags = getAuthTagValues(auth, "server");
  if (serverTags.length > 0 && !serverTags.some((server) => areServersEqual(server, request.server))) return false;

  if (request.type === "list") return true;

  const blobTags = getAuthTagValues(auth, "x");
  if (!request.blob) return false;

  const sha256 = typeof request.blob === "string" ? request.blob : await getBlobSha256(request.blob);

  if (blobTags.length === 0) return !requestRequiresHashTag(request.type);
  return blobTags.includes(sha256);
}

/** Finds a reusable auth event in a store and prunes expired events */
export async function getReusableAuthEvent(authEvents: Set<SignedEvent>, request: AuthRequest) {
  for (const auth of authEvents) {
    if (isAuthExpired(auth)) {
      authEvents.delete(auth);
      continue;
    }

    if (await doesAuthMatchRequest(auth, request)) return auth;
  }

  return undefined;
}

/** Stores a new auth event in the shared store */
export function storeAuthEvent(authEvents: Set<SignedEvent>, auth: SignedEvent) {
  authEvents.add(auth);
  return auth;
}

/** @deprecated Use `doseAuthMatchBlob` instead */
export const doseAuthMatchUpload = doseAuthMatchBlob;

async function normalizeToHash(blob: string | UploadType) {
  return typeof blob === "string" ? blob : getBlobSha256(blob);
}

function normalizeServers(servers: string | string[]) {
  const values = Array.isArray(servers) ? servers : [servers];
  return [...new Set(values.map((server) => normalizeServerTag(server)))];
}

function isDomainName(value: string) {
  return /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/i.test(value);
}

export type AuthType = "upload" | "list" | "delete" | "get" | "media";
export type AuthEventOptions = {
  blobs?: string | string[] | UploadType | UploadType[];
  servers?: string | string[];
  message?: string;
  expiration?: number;
};

/** Generic auth event builder */
export async function createAuthEvent(signer: Signer, type: AuthType, options?: AuthEventOptions) {
  const draft: EventTemplate = {
    created_at: now(),
    kind: AUTH_EVENT_KIND,
    content: options?.message ?? "",
    tags: [
      ["t", type],
      // attach NIP-40 expiration
      ["expiration", String(options?.expiration ?? oneHour())],
    ],
  };

  // add blob tags
  if (options?.blobs) {
    if (Array.isArray(options.blobs)) {
      const seen = new Set<string>();
      for (const blob of options.blobs) {
        const hash = await normalizeToHash(blob);
        if (!seen.has(hash)) {
          draft.tags.push(["x", hash]);
          seen.add(hash);
        }
      }
    } else draft.tags.push(["x", await normalizeToHash(options.blobs)]);
  }

  // add server tags
  if (options?.servers) {
    for (const server of normalizeServers(options.servers)) draft.tags.push(["server", server]);
  }

  return await signer(draft);
}

export type DownloadAuthOptions = Omit<AuthEventOptions, "blobs" | "servers">;
/** Creates a GET auth event */
export async function createDownloadAuth(
  signer: Signer,
  serverOrHash: string | string[] | UploadType | UploadType[],
  options?: DownloadAuthOptions,
) {
  if (!Array.isArray(serverOrHash)) serverOrHash = [serverOrHash] as string[] | UploadType[];

  return await createAuthEvent(signer, "get", {
    message: "Download Blob",
    ...options,
    blobs: serverOrHash.filter((s) => (typeof s === "string" ? isSha256(s) : true)) as string[] | UploadType[],
    servers: serverOrHash.filter(
      (s) => typeof s === "string" && !isSha256(s) && (URL.canParse(s) || isDomainName(s)),
    ) as string[],
  });
}

export type UploadAuthOptions = Omit<AuthEventOptions, "blobs"> & { type?: "upload" | "media" };
/** Creates an upload or media upload auth event */
export async function createUploadAuth(
  signer: Signer,
  blobs: string | string[] | UploadType | UploadType[],
  options?: UploadAuthOptions,
) {
  return await createAuthEvent(signer, options?.type ?? "upload", { message: "Upload Blob", ...options, blobs });
}

export type MirrorAuthOptions = Omit<AuthEventOptions, "blobs">;
/** Creates an upload or media upload auth event */
export async function createMirrorAuth(
  signer: Signer,
  blobs: string | string[] | UploadType | UploadType[],
  options?: MirrorAuthOptions,
) {
  // The /mirror endpoint uses "upload" type
  return await createAuthEvent(signer, "upload", { message: "Mirror Blob", ...options, blobs });
}

export type ListAuthOptions = Omit<AuthEventOptions, "blobs">;
/** Creates a list auth event */
export async function createListAuth(signer: Signer, options?: ListAuthOptions) {
  return await createAuthEvent(signer, "list", { message: "List Blobs", ...options });
}

export type DeleteAuthOptions = Omit<AuthEventOptions, "blobs">;
/** Creates a "delete" auth event for a specific hash */
export async function createDeleteAuth(
  signer: Signer,
  blobs: string | string[] | UploadType | UploadType[],
  options?: DeleteAuthOptions,
) {
  return await createAuthEvent(signer, "delete", { message: "Delete Blob", ...options, blobs });
}
