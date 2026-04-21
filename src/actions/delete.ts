import { encodeAuthorizationHeader, getReusableAuthEvent, storeAuthEvent } from "../auth.js";
import { ServerType } from "../types.js";
import HTTPError from "../error.js";
import { fetchWithTimeout } from "../helpers/fetch.js";
import { PaymentRequest, PaymentToken, SignedEvent } from "../types.js";

export type DeleteOptions<S extends ServerType> = {
  /** AbortSignal to cancel the action */
  signal?: AbortSignal;
  /** Override authorization event, or true to always use authorization, false to disable authorization */
  auth?: SignedEvent | boolean;
  /** Shared auth event store used to reuse non-expired auth events between requests */
  authEvents?: Set<SignedEvent>;
  /** Request timeout */
  timeout?: number;
  /**
   * A method used to request payment when deleting
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

/** Deletes a blob to a server */
export async function deleteBlob<S extends ServerType>(server: S, hash: string, opts?: DeleteOptions<S>) {
  const url = new URL("/" + hash, server);
  const resolveAuth = async (preset: boolean = false) => {
    const reused = opts?.authEvents
      ? await getReusableAuthEvent(opts.authEvents, { server, type: "delete", blob: hash })
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

  let res = await fetchWithTimeout(url, {
    method: "DELETE",
    headers,
    signal: opts?.signal,
    timeout: opts?.timeout,
  });

  // handle auth and payment
  switch (res.status) {
    case 401: {
      // throw an error if authorization is required but disabled
      if (opts?.auth === false) throw new Error("Authorization disabled");

      // request authorization for this request
      const auth = await resolveAuth();

      // Try delete with auth
      res = await fetchWithTimeout(url, {
        signal: opts?.signal,
        method: "DELETE",
        headers: { ...headers, Authorization: encodeAuthorizationHeader(auth) },
        timeout: opts?.timeout,
      });
      break;
    }
    case 402: {
      if (!opts?.onPayment) throw new Error("Missing payment handler");
      const { getEncodedToken } = await import("@cashu/cashu-ts");
      const { getPaymentRequestFromHeaders } = await import("../helpers/cashu.js");
      const request = await getPaymentRequestFromHeaders(res.headers);

      const token = await opts.onPayment(server, hash, request);
      const payment = getEncodedToken(token);

      // Try delete with payment
      res = await fetchWithTimeout(url, {
        signal: opts?.signal,
        method: "DELETE",
        headers: { ...headers, "X-Cashu": payment },
        timeout: opts?.timeout,
      });
      break;
    }
  }

  // handle errors
  await HTTPError.handleErrorResponse(res);

  // return blob descriptor
  return res.ok;
}
