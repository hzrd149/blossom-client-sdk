import { type Token } from "@cashu/cashu-ts";

import { ServerType } from "../client.js";
import { fetchWithHandlers } from "../fetch.js";
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

  const download = await fetchWithHandlers(
    url,
    { signal: opts?.signal },
    {
      402: async (res) => {
        if (!opts?.onPayment) throw new Error("Missing payment handler");
        const { getEncodedToken } = await import("@cashu/cashu-ts");
        const request = getPaymentRequestFromHeaders(res.headers);

        const token = await opts.onPayment(server, hash, request);
        const payment = getEncodedToken(token);

        // Try download with payment
        return fetch(url, {
          signal: opts?.signal,
          headers: { "X-Cashu": payment },
        });
      },
      403: async (_res) => {
        const auth = opts?.auth || (await opts?.onAuth?.(server, hash));
        if (!auth) throw new Error("Missing auth handler");

        // Try download with auth
        return fetch(url, {
          signal: opts?.signal,
          headers: { Authorization: encodeAuthorizationHeader(auth) },
        });
      },
    },
  );

  // check download errors
  await HTTPError.handleErrorResponse(download);

  // return the raw response
  return download;
}
