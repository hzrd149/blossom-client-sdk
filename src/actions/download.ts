import { type Token } from "@cashu/cashu-ts";

import { ServerType } from "../client.js";
import { PaymentRequest, SignedEvent } from "../types.js";
import HTTPError from "../error.js";
import { encodeAuthorizationHeader } from "../auth.js";
import { fetchWithTimeout, getPaymentRequestFromHeaders } from "../helpers/index.js";

export type DownloadOptions<S extends ServerType> = {
  /** AbortSignal to cancel the action */
  signal?: AbortSignal;
  /** Override auth event to use */
  auth?: SignedEvent;
  /** Request timeout */
  timeout?: number;
  /**
   * A method used to request payment when downloading
   * @param server the server requiring payment
   * @param sha256 the sha256 of the blob being uploaded or mirrored
   * @param request the payment request
   */
  onPayment?: (server: S, sha256: string, request: PaymentRequest) => Promise<Token>;
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

  // attach the auth if its already set
  if (opts?.auth) headers["Authorization"] = encodeAuthorizationHeader(opts.auth);

  let download = await fetchWithTimeout(url, {
    headers,
    signal: opts?.signal,
    timeout: opts?.timeout,
  });

  // handle auth and payment
  switch (download.status) {
    case 401: {
      const auth = opts?.auth || (await opts?.onAuth?.(server, hash));
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
