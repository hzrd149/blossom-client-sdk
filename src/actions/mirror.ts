import { encodeAuthorizationHeader, getReusableAuthEvent, storeAuthEvent } from "../auth.js";
import { ServerType } from "../types.js";
import HTTPError from "../error.js";
import { fetchWithTimeout } from "../helpers/index.js";
import { handleChallenges } from "../internal/challenges.js";
import { BlobDescriptor, PaymentRequest, PaymentToken, SignedEvent } from "../types.js";

export type MirrorOptions<S extends ServerType> = {
  /** AbortSignal to cancel the action */
  signal?: AbortSignal;
  /** Override authorization event, or true to always use authorization, false to disable authorization */
  auth?: SignedEvent | boolean;
  /** Shared auth event store used to reuse non-expired auth events between requests */
  authEvents?: Set<SignedEvent>;
  /** Request timeout */
  timeout?: number;
  /** Return headers to retry a request rejected with HTTP 402. */
  onPaymentRequired?: (server: S, sha256: string, blob: BlobDescriptor, headers: Headers) => Promise<HeadersInit>;
  /**
   * A method used to request payment when uploading or mirroring a blob
   * @param server the server requiring payment
   * @param sha256 the sha256 of the blob being uploaded or mirrored
   * @param blob the original blob
   * @param request the payment request
   */
  /** @deprecated Use onPaymentRequired to handle payment schemes generically. */
  onPayment?: (server: S, sha256: string, blob: BlobDescriptor, request: PaymentRequest) => Promise<PaymentToken>;
  /**
   * A method used to request a signed auth event for a server and sha256
   * @param server the server requesting the auth
   * @param sha256 the sha256 of the blob being upload or mirror to the server
   * @param blob the original blob passed to the method
   */
  onAuth?: (server: S, sha256: string, blob: BlobDescriptor) => Promise<SignedEvent>;
};

/** Mirrors a blob to a server */
export async function mirrorBlob<S extends ServerType>(
  server: S,
  blob: BlobDescriptor,
  opts?: MirrorOptions<S>,
): Promise<BlobDescriptor> {
  const url = new URL("/mirror", server);
  const resolveAuth = async (preset: boolean = false) => {
    const reused = opts?.authEvents
      ? await getReusableAuthEvent(opts.authEvents, { server, type: "upload", blob: blob.sha256 })
      : undefined;
    if (reused) return reused;

    const auth = await opts?.onAuth?.(server, blob.sha256, blob);
    if (!auth) throw new Error(preset ? "Missing onAuth handler" : "Missing auth handler");

    if (opts?.authEvents) storeAuthEvent(opts.authEvents, auth);
    return auth;
  };

  const headers: Record<string, string> = {
    "X-SHA-256": blob.sha256,
    "X-Content-Length": String(blob.size),
    "Content-Type": "application/json",
  };
  if (blob.type) headers["X-Content-Type"] = blob.type;

  // attach the authorization if its already set
  if (opts?.auth) {
    if (typeof opts.auth === "boolean") {
      headers["Authorization"] = encodeAuthorizationHeader(await resolveAuth(true));
    } else {
      headers["Authorization"] = encodeAuthorizationHeader(opts.auth);
    }
  }

  const body = JSON.stringify({ url: blob.url });
  const request = (headers: HeadersInit) =>
    fetchWithTimeout(url, { method: "PUT", body, headers, signal: opts?.signal, timeout: opts?.timeout });
  const mirror = await handleChallenges(await request(headers), headers, request, {
    signal: opts?.signal,
    auth: async () => {
      if (opts?.auth === false) throw new Error("Authorization disabled");
      return { Authorization: encodeAuthorizationHeader(await resolveAuth()) };
    },
    payment: async (headers) => {
      if (opts?.onPaymentRequired) return opts.onPaymentRequired(server, blob.sha256, blob, headers);
      if (opts?.onPayment) {
        const { encodePaymentToken, getPaymentRequestFromHeaders } = await import("../helpers/cashu.js");
        const request = await getPaymentRequestFromHeaders(headers);
        return { "X-Cashu": encodePaymentToken(await opts.onPayment(server, blob.sha256, blob, request)) };
      }
      throw new Error("Missing payment handler");
    },
  });

  // handle errors
  await HTTPError.handleErrorResponse(mirror);

  // return blob descriptor
  return mirror.json();
}
