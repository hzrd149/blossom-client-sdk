import { type Token } from "@cashu/cashu-ts";

import { ServerType } from "../client.js";
import { PaymentRequest, SignedEvent } from "../types.js";
import { fetchWithHandlers } from "../fetch.js";
import HTTPError from "../error.js";
import { encodeAuthorizationHeader } from "../auth.js";
import { getPaymentRequestFromHeaders } from "../helpers.js";

export type DeleteOptions<S extends ServerType> = {
  signal?: AbortSignal;
  auth?: SignedEvent;
  onPayment?: (server: S, hash: string, request: PaymentRequest) => Promise<Token>;
  onAuth?: (server: S, hash: string) => Promise<SignedEvent>;
};

/** Deletes a blob to a server */
export async function deleteBlob<S extends ServerType>(server: S, hash: string, opts?: DeleteOptions<S>) {
  const url = new URL("/" + hash, server);

  const res = await fetchWithHandlers(
    url,
    { signal: opts?.signal, method: "DELETE" },
    {
      402: async (res) => {
        if (!opts?.onPayment) throw new Error("Missing payment handler");
        const { getEncodedToken } = await import("@cashu/cashu-ts");
        const request = getPaymentRequestFromHeaders(res.headers);

        const token = await opts.onPayment(server, hash, request);
        const payment = getEncodedToken(token);

        // Try delete with payment
        return fetch(url, {
          signal: opts?.signal,
          method: "DELETE",
          headers: { "X-Cashu": payment },
        });
      },
      403: async (_res) => {
        const auth = opts?.auth || (await opts?.onAuth?.(server, hash));
        if (!auth) throw new Error("Missing auth handler");

        // Try delete with auth
        return fetch(url, {
          signal: opts?.signal,
          method: "DELETE",
          headers: { Authorization: encodeAuthorizationHeader(auth) },
        });
      },
    },
  );

  // handle errors
  await HTTPError.handleErrorResponse(res);

  // return blob descriptor
  return res.ok;
}
