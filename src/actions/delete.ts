import { type Token } from "@cashu/cashu-ts";

import { ServerType } from "../client.js";
import { PaymentRequest, SignedEvent } from "../types.js";
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

  let res = await fetch(url, { signal: opts?.signal, method: "DELETE" });

  // handle auth and payment
  switch (res.status) {
    case 402: {
      if (!opts?.onPayment) throw new Error("Missing payment handler");
      const { getEncodedToken } = await import("@cashu/cashu-ts");
      const request = getPaymentRequestFromHeaders(res.headers);

      const token = await opts.onPayment(server, hash, request);
      const payment = getEncodedToken(token);

      // Try delete with payment
      res = await fetch(url, {
        signal: opts?.signal,
        method: "DELETE",
        headers: { "X-Cashu": payment },
      });
      break;
    }

    case 403: {
      const auth = opts?.auth || (await opts?.onAuth?.(server, hash));
      if (!auth) throw new Error("Missing auth handler");

      // Try delete with auth
      res = await fetch(url, {
        signal: opts?.signal,
        method: "DELETE",
        headers: { Authorization: encodeAuthorizationHeader(auth) },
      });
      break;
    }
  }

  // handle errors
  await HTTPError.handleErrorResponse(res);

  // return blob descriptor
  return res.ok;
}
