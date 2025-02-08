import { type Token } from "@cashu/cashu-ts";

import HTTPError from "../error.js";
import { ServerType } from "../client.js";
import { BlobDescriptor, PaymentRequest, SignedEvent } from "../types.js";
import { encodeAuthorizationHeader } from "../auth.js";
import { fetchWithTimeout, getPaymentRequestFromHeaders } from "../helpers/index.js";

export type ListOptions<S extends ServerType> = {
  /** AbortSignal to cancel the action */
  signal?: AbortSignal;
  /** Override auth event to use */
  auth?: SignedEvent;
  /** Request timeout */
  timeout?: number;
  since?: number;
  until?: number;
  /**
   * A method used to request payment
   * @param server the server requiring payment
   * @param request the payment request
   */
  onPayment?: (server: S, request: PaymentRequest) => Promise<Token>;
  /**
   * A method used to request a signed auth event for a server
   * @param server the server requesting the auth
   */
  onAuth?: (server: S) => Promise<SignedEvent>;
};

/** Mirrors a blob to a server */
export async function listBlobs<S extends ServerType>(
  server: S,
  pubkey: string,
  opts?: ListOptions<S>,
): Promise<BlobDescriptor[]> {
  const url = new URL(`/list/` + pubkey, server);
  if (opts?.since) url.searchParams.append("since", String(opts.since));
  if (opts?.until) url.searchParams.append("until", String(opts.until));

  let list = await fetchWithTimeout(url, { signal: opts?.signal, timeout: opts?.timeout });

  // handle auth and payments
  switch (list.status) {
    case 401: {
      const auth = opts?.auth || (await opts?.onAuth?.(server));
      if (!auth) throw new Error("Missing auth handler");

      // Try list with auth
      list = await fetchWithTimeout(url, {
        headers: { Authorization: encodeAuthorizationHeader(auth) },
        signal: opts?.signal,
        timeout: opts?.timeout,
      });
      break;
    }
    case 402: {
      if (!opts?.onPayment) throw new Error("Missing payment handler");
      const { getEncodedToken } = await import("@cashu/cashu-ts");
      const request = getPaymentRequestFromHeaders(list.headers);

      const token = await opts.onPayment(server, request);
      const payment = getEncodedToken(token);

      // Try list with payment
      list = await fetchWithTimeout(url, {
        headers: { "X-Cashu": payment },
        signal: opts?.signal,
        timeout: opts?.timeout,
      });
      break;
    }
  }

  // handle errors
  await HTTPError.handleErrorResponse(list);

  // return blob descriptor
  return list.json();
}
