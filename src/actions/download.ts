import { ServerType } from "../types.js";
import { PaymentRequest, PaymentToken, SignedEvent } from "../types.js";
import HTTPError from "../error.js";
import { encodeAuthorizationHeader, getReusableAuthEvent, storeAuthEvent } from "../auth.js";
import { fetchWithTimeout } from "../helpers/index.js";
import { mergeHeaders } from "../helpers/headers.js";

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

  let download = await fetchWithTimeout(url, {
    headers,
    signal: opts?.signal,
    timeout: opts?.timeout,
  });

  // handle auth and payment
  switch (download.status) {
    case 401: {
      // throw an error if auth is requested and disabled
      if (opts?.auth === false) throw new Error("Authorization disabled");

      // Request authorization for this request
      const auth = await resolveAuth();

      // Try download with auth
      download = await fetchWithTimeout(url, {
        headers: { ...headers, Authorization: encodeAuthorizationHeader(auth) },
        signal: opts?.signal,
        timeout: opts?.timeout,
      });

      break;
    }
    case 402: {
      let paymentHeaders: HeadersInit;
      if (opts?.onPaymentRequired) paymentHeaders = await opts.onPaymentRequired(server, hash, download.headers);
      else if (opts?.onPayment) {
        const { encodePaymentToken, getPaymentRequestFromHeaders } = await import("../helpers/cashu.js");
        const request = await getPaymentRequestFromHeaders(download.headers);
        paymentHeaders = { "X-Cashu": encodePaymentToken(await opts.onPayment(server, hash, request)) };
      } else throw new Error("Missing payment handler");

      // Try download with payment
      download = await fetchWithTimeout(url, {
        headers: mergeHeaders(headers, paymentHeaders),
        signal: opts?.signal,
        timeout: opts?.timeout,
      });

      break;
    }
  }

  // check download errors
  await HTTPError.handleErrorResponse(download);

  // return the raw response
  return download;
}
