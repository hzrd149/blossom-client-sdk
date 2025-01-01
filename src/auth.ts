import { ServerType, UploadType } from "./client.js";
import { AUTH_EVENT_KIND } from "./const.js";
import { areServersEqual, getBlobSha256, isSha256 } from "./helpers.js";
import { EventTemplate, SignedEvent, Signer } from "./types.js";

export const now = () => Math.floor(new Date().valueOf() / 1000);
export const oneHour = () => now() + 60 * 60;

export function encodeAuthorizationHeader(event: SignedEvent) {
  return "Nostr " + btoa(JSON.stringify(event));
}

/** Checks if an auth event matches a server / blob upload */
export async function doseAuthMatchUpload(auth: SignedEvent, server: ServerType, blob: string | UploadType) {
  const type = auth.tags.find((t) => t[0] === "t")?.[1];
  if (type !== "upload" && type !== "media") return false;

  const sha256 = typeof blob === "string" ? blob : await getBlobSha256(blob);

  for (const tag of auth.tags) {
    switch (tag[0]) {
      case "x":
        if (tag[1] === sha256) return true;
        break;
      case "server":
        if (areServersEqual(tag[1], server)) return true;
        break;
    }
  }

  return false;
}

async function normalizeToHash(blob: string | UploadType) {
  return typeof blob === "string" ? blob : getBlobSha256(blob);
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
    if (Array.isArray(options.blobs))
      for (const blob of options.blobs) draft.tags.push(["x", await normalizeToHash(blob)]);
    else draft.tags.push(["x", await normalizeToHash(options.blobs)]);
  }

  // add server tags
  if (options?.servers) {
    if (Array.isArray(options.servers)) for (const blob of options.servers) draft.tags.push(["server", blob]);
    else draft.tags.push(["server", options.servers]);
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
    servers: serverOrHash.filter((s) => typeof s === "string" && !isSha256(s) && URL.canParse(s)) as string[],
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
