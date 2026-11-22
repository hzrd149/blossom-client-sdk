import { ServerType, UploadType } from "../types.js";
import { BlobDescriptor } from "../types.js";
import { getBlobSha256, getBlobSize, getBlobType } from "../helpers/index.js";
import { handleChallenges } from "../internal/challenges.js";
import HTTPError from "../error.js";
import { encodeAuthorizationHeader, getReusableAuthEvent, storeAuthEvent } from "../auth.js";
import { SignedEvent } from "../types.js";
import { UploadOptions } from "./upload.js";
import { toWebBytes } from "../internal/bytes.js";

/** Error thrown when /media endpoint is not present on a server */
export class MediaEndpointMissingError extends Error {}

export type UploadMediaOptions<S extends ServerType, B extends UploadType> = UploadOptions<S, B>;

/** Upload a media blob to a server using the /media endpoint, handles payment and auth */
export async function uploadMedia<S extends ServerType, B extends UploadType>(
  server: S,
  blob: B,
  opts?: UploadMediaOptions<S, B>,
): Promise<BlobDescriptor> {
  const url = new URL("/media", server);
  const sha256 = await getBlobSha256(blob);
  const body = blob instanceof Blob ? blob : toWebBytes(blob);
  const authEvents = opts?.authEvents as Set<SignedEvent> | undefined;
  const resolveAuth = async (preset: boolean = false) => {
    const reused = authEvents
      ? await getReusableAuthEvent(authEvents, { server, type: "media", blob: sha256 })
      : undefined;
    if (reused) return reused;

    const auth = await opts?.onAuth?.(server, sha256, "media", blob);
    if (!auth) throw new Error(preset ? "Missing onAuth handler" : "Missing auth handler");

    if (authEvents) storeAuthEvent(authEvents, auth);
    return auth;
  };

  const headers: Record<string, string> = {
    "X-SHA-256": sha256,
  };

  // attach the authorization if its already set
  if (opts?.auth) {
    if (typeof opts.auth === "boolean") {
      headers["Authorization"] = encodeAuthorizationHeader(await resolveAuth(true));
    } else {
      headers["Authorization"] = encodeAuthorizationHeader(opts.auth);
    }
  }

  // build check headers
  const checkHeaders: Record<string, string> = {
    ...headers,
    "X-Content-Length": String(getBlobSize(blob)),
  };
  const type = getBlobType(blob);
  if (type) checkHeaders["X-Content-Type"] = type;

  // check upload with HEAD /media
  const firstTry = await fetch(url, {
    method: "HEAD",
    signal: opts?.signal,
    headers: checkHeaders,
  });

  if (firstTry.status === 404) {
    // HEAD endpoint is not supported. abort
    throw new MediaEndpointMissingError("/media endpoint not supported");
  }

  if (![401, 402].includes(firstTry.status)) await HTTPError.handleErrorResponse(firstTry);

  const request = (headers: HeadersInit) =>
    fetch(url, {
      signal: opts?.signal,
      method: "PUT",
      body,
      headers,
    });

  const upload = await handleChallenges(firstTry.ok ? await request(headers) : firstTry, headers, request, {
    signal: opts?.signal,
    auth: async () => {
      if (opts?.auth === false) throw new Error("Authorization disabled");
      return { Authorization: encodeAuthorizationHeader(await resolveAuth()) };
    },
    payment: async (headers) => {
      if (opts?.onPaymentRequired) return opts.onPaymentRequired(server, sha256, blob, headers);
      if (opts?.onPayment) {
        const { encodePaymentToken, getPaymentRequestFromHeaders } = await import("../helpers/cashu.js");
        const request = await getPaymentRequestFromHeaders(headers);
        return { "X-Cashu": encodePaymentToken(await opts.onPayment(server, sha256, blob, request)) };
      }
      throw new Error("Missing payment handler");
    },
  });

  // handle errors
  await HTTPError.handleErrorResponse(upload);

  // return blob descriptor
  return upload.json();
}
