import { type Token } from "@cashu/cashu-ts";
import { ServerType } from "../client.js";
import { BlobDescriptor, SignedEvent, PaymentRequest } from "../types.js";
import HTTPError from "../error.js";
import { encodeAuthorizationHeader } from "../auth.js";
import { getPaymentRequestFromHeaders } from "../helpers.js";

export type MirrorOptions<S extends ServerType> = {
  /** AbortSignal to cancel the action */
  signal?: AbortSignal;
  /** Override auth event to use */
  auth?: SignedEvent;
  /**
   * A method used to request payment when uploading or mirroring a blob
   * @param server the server requiring payment
   * @param sha256 the sha256 of the blob being uploaded or mirrored
   * @param blob the original blob
   * @param request the payment request
   */
  onPayment?: (server: S, sha256: string, blob: BlobDescriptor, request: PaymentRequest) => Promise<Token>;
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
  };
  if (blob.type) headers["X-Content-Type"] = blob.type;

  // attach the auth if its already set
  if (opts?.auth) headers["Authorization"] = encodeAuthorizationHeader(opts.auth);

  const body = JSON.stringify({ url: blob.url });
  let mirror = await fetch(url, {
    method: "PUT",
    signal: opts?.signal,
    headers,
    body,
  });

  switch (mirror.status) {
    case 401: {
      const auth = opts?.auth || (await opts?.onAuth?.(server, blob.sha256, blob));
      if (!auth) throw new Error("Missing auth handler");

      // Try mirror with auth
      mirror = await fetch(url, {
        signal: opts?.signal,
        method: "PUT",
        body,
        headers: { Authorization: encodeAuthorizationHeader(auth) },
      });
      break;
    }
    case 402: {
      if (!opts?.onPayment) throw new Error("Missing payment handler");
      const { getEncodedToken } = await import("@cashu/cashu-ts");
      const request = getPaymentRequestFromHeaders(mirror.headers);

      const token = await opts.onPayment(server, blob.sha256, blob, request);
      const payment = getEncodedToken(token);

      // Try mirror with payment
      mirror = await fetch(url, {
        signal: opts?.signal,
        method: "PUT",
        body,
        headers: { "X-Cashu": payment },
      });
      break;
    }
  }

  // handle errors
  await HTTPError.handleErrorResponse(mirror);

  // return blob descriptor
  return mirror.json();
}
