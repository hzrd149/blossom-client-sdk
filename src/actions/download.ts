import { ServerType } from "../client.js";
import { PaymentRequest, PaymentToken, SignedEvent } from "../types.js";
import HTTPError from "../error.js";
import { encodeAuthorizationHeader } from "../auth.js";
import { fetchWithTimeout } from "../helpers/index.js";

export type DownloadOptions<S extends ServerType> = {
  /** AbortSignal to cancel the action */
  signal?: AbortSignal;
  /** Override authorization event, or true to always use authorization, false to disable authorization */
  auth?: SignedEvent | boolean;
  /** Request timeout */
  timeout?: number;
  /**
   * A method used to request payment when downloading
   * @param server the server requiring payment
   * @param sha256 the sha256 of the blob being uploaded or mirrored
   * @param request the payment request
   */
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

  const headers: HeadersInit = {};

  // attach the authorization if its already set
  if (opts?.auth) {
    if (typeof opts.auth === "boolean") {
      if (!opts.onAuth) throw new Error("Missing onAuth handler");
      headers["Authorization"] = encodeAuthorizationHeader(await opts.onAuth(server, hash));
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
      const auth = await opts?.onAuth?.(server, hash);
      if (!auth) throw new Error("Missing auth handler");

      // Try download with auth
      download = await fetchWithTimeout(url, {
        headers: { ...headers, Authorization: encodeAuthorizationHeader(auth) },
        signal: opts?.signal,
        timeout: opts?.timeout,
      });

      break;
    }
    case 402: {
      if (!opts?.onPayment) throw new Error("Missing payment handler");
      const { getEncodedToken } = await import("@cashu/cashu-ts");
      const { getPaymentRequestFromHeaders } = await import("../helpers/cashu.js");
      const request = getPaymentRequestFromHeaders(download.headers);

      const token = await opts.onPayment(server, hash, request);
      const payment = getEncodedToken(token);

      // Try download with payment
      download = await fetchWithTimeout(url, {
        headers: { ...headers, "X-Cashu": payment },
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
