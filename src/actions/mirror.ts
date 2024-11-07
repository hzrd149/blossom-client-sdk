import { type Token } from "@cashu/cashu-ts";
import { ServerType } from "../client.js";
import { BlobDescriptor, SignedEvent, PaymentRequest } from "../types.js";
import { fetchWithHandlers } from "../fetch.js";
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
  const mirror = await fetchWithHandlers(
    url,
    {
      method: "PUT",
      signal: opts?.signal,
      headers,
      body,
    },
    {
      402: async (res) => {
        if (!opts?.onPayment) throw new Error("Missing payment handler");
        const { getEncodedToken } = await import("@cashu/cashu-ts");
        const request = getPaymentRequestFromHeaders(res.headers);

        const token = await opts.onPayment(server, blob, request);
        const payment = getEncodedToken(token);

        // Try mirror with payment
        return fetch(url, {
          signal: opts?.signal,
          method: "PUT",
          body,
          headers: { "X-Cashu": payment },
        });
      },
      403: async (_res) => {
        const auth = opts?.auth || (await opts?.onAuth?.(server, blob));
        if (!auth) throw new Error("Missing auth handler");

        // Try mirror with auth
        return fetch(url, {
          signal: opts?.signal,
          method: "PUT",
          body,
          headers: { Authorization: encodeAuthorizationHeader(auth) },
        });
      },
    },
  );

  // handle errors
  await HTTPError.handleErrorResponse(mirror);

  // return blob descriptor
  return mirror.json();
}
