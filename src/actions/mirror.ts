import { encodeAuthorizationHeader } from "../auth.js";
import { ServerType } from "../client.js";
import HTTPError from "../error.js";
import { fetchWithTimeout } from "../helpers/index.js";
import { BlobDescriptor, PaymentRequest, PaymentToken, SignedEvent } from "../types.js";

export type MirrorOptions<S extends ServerType> = {
  /** AbortSignal to cancel the action */
  signal?: AbortSignal;
  /** Override authorization event, or true to always use authorization, false to disable authorization */
  auth?: SignedEvent | boolean;
  /** Request timeout */
  timeout?: number;
  /**
   * A method used to request payment when uploading or mirroring a blob
   * @param server the server requiring payment
   * @param sha256 the sha256 of the blob being uploaded or mirrored
   * @param blob the original blob
   * @param request the payment request
   */
  onPayment?: (server: S, sha256: string, blob: BlobDescriptor, request: PaymentRequest) => Promise<PaymentToken>;
  /**
   * A method used to request a signed auth event for a server and sha256
   * @param server the server requesting the auth
   * @param sha256 the sha256 of the blob being upload or mirror to the server
   * @param blob the original blob passed to the method
   */
  onAuth?: (server: S, sha256: string, blob: BlobDescriptor) => Promise<SignedEvent>;
};

/** Mirrors a blob to a server */
export async function mirrorBlob<S extends ServerType>(
  server: S,
  blob: BlobDescriptor,
  opts?: MirrorOptions<S>,
): Promise<BlobDescriptor> {
  const url = new URL("/mirror", server);

  const headers: Record<string, string> = {
    "X-SHA-256": blob.sha256,
    "X-Content-Length": String(blob.size),
    "Content-Type": "application/json",
  };
  if (blob.type) headers["X-Content-Type"] = blob.type;

  // attach the authorization if its already set
  if (opts?.auth) {
    if (typeof opts.auth === "boolean") {
      if (!opts.onAuth) throw new Error("Missing onAuth handler");
      headers["Authorization"] = encodeAuthorizationHeader(await opts.onAuth(server, blob.sha256, blob));
    } else {
      headers["Authorization"] = encodeAuthorizationHeader(opts.auth);
    }
  }

  const body = JSON.stringify({ url: blob.url });
  let mirror = await fetchWithTimeout(url, {
    method: "PUT",
    signal: opts?.signal,
    headers,
    body,
    timeout: opts?.timeout,
  });

  switch (mirror.status) {
    case 401: {
      // throw an error if auth is requested and disabled
      if (opts?.auth === false) throw new Error("Authorization disabled");

      // Request authorization event for this mirror
      const auth = await opts?.onAuth?.(server, blob.sha256, blob);
      if (!auth) throw new Error("Missing auth handler");

      // Try mirror with auth
      mirror = await fetchWithTimeout(url, {
        signal: opts?.signal,
        method: "PUT",
        body,
        headers: { ...headers, Authorization: encodeAuthorizationHeader(auth) },
        timeout: opts?.timeout,
      });
      break;
    }
    case 402: {
      if (!opts?.onPayment) throw new Error("Missing payment handler");
      const { getEncodedToken } = await import("@cashu/cashu-ts");
      const { getPaymentRequestFromHeaders } = await import("../helpers/cashu.js");
      const request = getPaymentRequestFromHeaders(mirror.headers);

      const token = await opts.onPayment(server, blob.sha256, blob, request);
      const payment = getEncodedToken(token);

      // Try mirror with payment
      mirror = await fetchWithTimeout(url, {
        signal: opts?.signal,
        method: "PUT",
        body,
        headers: { ...headers, "X-Cashu": payment },
        timeout: opts?.timeout,
      });
      break;
    }
  }

  // handle errors
  await HTTPError.handleErrorResponse(mirror);

  // return blob descriptor
  return mirror.json();
}
