import { type Token } from "@cashu/cashu-ts";
import { ServerType } from "../client.js";
import { BlobDescriptor, SignedEvent, PaymentRequest } from "../types.js";
import HTTPError from "../error.js";
import { encodeAuthorizationHeader } from "../auth.js";
import { getPaymentRequestFromHeaders } from "../helpers.js";

export type MirrorOptions<S extends ServerType> = {
  signal?: AbortSignal;
  auth?: SignedEvent;
  onPayment?: (server: S, blob: BlobDescriptor, request: PaymentRequest) => Promise<Token>;
  onAuth?: (server: S, blob: BlobDescriptor) => Promise<SignedEvent>;
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

  const body = JSON.stringify({ url: blob.url });
  let mirror = await fetch(url, {
    method: "PUT",
    signal: opts?.signal,
    headers,
    body,
  });

  switch (mirror.status) {
    case 401: {
      const auth = opts?.auth || (await opts?.onAuth?.(server, blob));
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

      const token = await opts.onPayment(server, blob, request);
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
