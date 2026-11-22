import { ServerType } from "../types.js";
import { PaymentRequest, PaymentToken, SignedEvent } from "../types.js";
import HTTPError from "../error.js";
import { encodeAuthorizationHeader, getReusableAuthEvent, storeAuthEvent } from "../auth.js";
import { fetchWithTimeout } from "../helpers/index.js";
import { handleChallenges } from "../internal/challenges.js";

export type DownloadOptions<S extends ServerType> = {
  /** AbortSignal to cancel the action */
  signal?: AbortSignal;
  /** Override authorization event, or true to always use authorization, false to disable authorization */
  auth?: SignedEvent | boolean;
  /** Shared auth event store used to reuse non-expired auth events between requests */
  authEvents?: Set<SignedEvent>;
  /** Request timeout */
  timeout?: number;
  /** Return headers to retry a request rejected with HTTP 402. */
  onPaymentRequired?: (server: S, sha256: string, headers: Headers) => Promise<HeadersInit>;
  /**
   * A method used to request payment when downloading
   * @param server the server requiring payment
   * @param sha256 the sha256 of the blob being uploaded or mirrored
   * @param request the payment request
   */
  /** @deprecated Use onPaymentRequired to handle payment schemes generically. */
  onPayment?: (server: S, sha256: string, request: PaymentRequest) => Promise<PaymentToken>;
  /**
   * A method used to request a signed auth event for a server and sha256
   * @param server the server requesting the auth
   * @param sha256 the sha256 of the blob being upload or mirror to the server
   */
  onAuth?: (server: S, sha256: string) => Promise<SignedEvent>;
};

/** Downloads a blob from a server and returns the Response */
export async function downloadBlob<S extends ServerType>(server: S, hash: string, opts?: DownloadOptions<S>) {
  const url = new URL("/" + hash, server);
  const resolveAuth = async (preset: boolean = false) => {
    const reused = opts?.authEvents
      ? await getReusableAuthEvent(opts.authEvents, { server, type: "get", blob: hash })
      : undefined;
    if (reused) return reused;

    const auth = await opts?.onAuth?.(server, hash);
    if (!auth) throw new Error(preset ? "Missing onAuth handler" : "Missing auth handler");

    if (opts?.authEvents) storeAuthEvent(opts.authEvents, auth);
    return auth;
  };

  const headers: HeadersInit = {};

  // attach the authorization if its already set
  if (opts?.auth) {
    if (typeof opts.auth === "boolean") {
      headers["Authorization"] = encodeAuthorizationHeader(await resolveAuth(true));
    } else {
      headers["Authorization"] = encodeAuthorizationHeader(opts.auth);
    }
  }

  const request = (headers: HeadersInit) =>
    fetchWithTimeout(url, { headers, signal: opts?.signal, timeout: opts?.timeout });
  const download = await handleChallenges(await request(headers), headers, request, {
    signal: opts?.signal,
    auth: async () => {
      if (opts?.auth === false) throw new Error("Authorization disabled");
      return { Authorization: encodeAuthorizationHeader(await resolveAuth()) };
    },
    payment: async (headers) => {
      if (opts?.onPaymentRequired) return opts.onPaymentRequired(server, hash, headers);
      if (opts?.onPayment) {
        const { encodePaymentToken, getPaymentRequestFromHeaders } = await import("../helpers/cashu.js");
        const request = await getPaymentRequestFromHeaders(headers);
        return { "X-Cashu": encodePaymentToken(await opts.onPayment(server, hash, request)) };
      }
      throw new Error("Missing payment handler");
    },
  });

  // check download errors
  await HTTPError.handleErrorResponse(download);

  // return the raw response
  return download;
}
