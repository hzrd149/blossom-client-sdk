import { type Token } from "@cashu/cashu-ts";

import { ServerType } from "../client.js";
import { PaymentRequest, SignedEvent } from "../types.js";
import HTTPError from "../error.js";
import { encodeAuthorizationHeader } from "../auth.js";
import { getPaymentRequestFromHeaders } from "../helpers.js";

export type DownloadOptions<S extends ServerType> = {
  signal?: AbortSignal;
  auth?: SignedEvent;
  onPayment?: (server: S, hash: string, request: PaymentRequest) => Promise<Token>;
  onAuth?: (server: S, hash: string) => Promise<SignedEvent>;
};

/** Downloads a blob from a server and returns the Response */
export async function downloadBlob<S extends ServerType>(server: S, hash: string, opts?: DownloadOptions<S>) {
  const url = new URL("/" + hash, server);

  const headers: HeadersInit = {};

  // attach the auth if its already set
  if (opts?.auth) headers["Authorization"] = encodeAuthorizationHeader(opts.auth);

  let download = await fetch(url, { signal: opts?.signal, headers });

  // handle auth and payment
  switch (download.status) {
    case 401: {
      const auth = opts?.auth || (await opts?.onAuth?.(server, hash));
      if (!auth) throw new Error("Missing auth handler");

      // Try download with auth
      download = await fetch(url, {
        signal: opts?.signal,
        headers: { ...headers, Authorization: encodeAuthorizationHeader(auth) },
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
      download = await fetch(url, {
        signal: opts?.signal,
        headers: { ...headers, "X-Cashu": payment },
      });

      break;
    }
  }

  // check download errors
  await HTTPError.handleErrorResponse(download);

  // return the raw response
  return download;
}
