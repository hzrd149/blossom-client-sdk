import { type Token } from "@cashu/cashu-ts";

import { ServerType, UploadType } from "../client.js";
import { BlobDescriptor, PaymentRequest, SignedEvent } from "../types.js";
import { getBlobSha256, getBlobSize, getBlobType, getPaymentRequestFromHeaders } from "../helpers.js";
import HTTPError from "../error.js";
import { doseAuthMatchUpload, encodeAuthorizationHeader } from "../auth.js";
import { mirrorBlob } from "./mirror.js";

export type UploadOptions<S extends ServerType, B extends UploadType> = {
  signal?: AbortSignal;
  auth?: SignedEvent;
  onPayment?: (server: S, blob: B, request: PaymentRequest) => Promise<Token>;
  onAuth?: (server: S, blob: B) => Promise<SignedEvent>;
};

/** Upload a blob to a server, handles payment and auth */
export async function uploadBlob<S extends ServerType, B extends UploadType>(
  server: S,
  blob: B,
  opts?: UploadOptions<S, B>,
): Promise<BlobDescriptor> {
  const url = new URL("/upload", server);
  const hash = await getBlobSha256(blob);

  const headers: Record<string, string> = {
    "X-SHA-256": hash,
  };

  // build check headers
  const checkHeaders: Record<string, string> = {
    ...headers,
    "X-Content-Length": String(getBlobSize(blob)),
  };
  const type = getBlobType(blob);
  if (type) checkHeaders["X-Content-Type"] = type;

  // check upload with HEAD /upload
  let check = await fetch(url, {
    method: "HEAD",
    signal: opts?.signal,
    headers: checkHeaders,
  });

  let upload: Response | undefined = undefined;

  switch (check.status) {
    case 402: {
      if (!opts?.onPayment) throw new Error("Missing payment handler");
      const { getEncodedToken } = await import("@cashu/cashu-ts");
      const request = getPaymentRequestFromHeaders(check.headers);

      const token = await opts.onPayment(server, blob, request);
      const payment = getEncodedToken(token);

      // Try upload with payment
      upload = await fetch(url, {
        signal: opts?.signal,
        method: "PUT",
        body: blob,
        headers: { ...headers, "X-Cashu": payment },
      });
      break;
    }

    case 403: {
      const auth = opts?.auth || (await opts?.onAuth?.(server, blob));
      if (!auth) throw new Error("Missing auth handler");

      // Try upload with auth
      upload = await fetch(url, {
        signal: opts?.signal,
        method: "PUT",
        body: blob,
        headers: { ...headers, Authorization: encodeAuthorizationHeader(auth) },
      });
      break;
    }
  }

  if (check.status >= 500) throw new Error("Server error");

  // check passed, upload
  if (!upload)
    upload = await fetch(url, {
      signal: opts?.signal,
      method: "PUT",
      body: blob,
      headers: { ...headers },
    });

  // handle errors
  await HTTPError.handleErrorResponse(upload);

  // check upload errors
  await HTTPError.handleErrorResponse(upload);

  // return blob descriptor
  return upload.json();
}

export type MultiServerUploadOptions<S extends ServerType, B extends UploadType> = UploadOptions<S, B> & {
  onStart?: (server: S, blob: B) => void;
  onUpload?: (server: S, blob: B) => void;
  onError?: (server: S, blob: B, error: Error) => void;
};

/**
 * Creates an AsyncGenerator that can be used to upload a blob to multiple servers
 * @param servers A Set or Array of servers to upload to
 * @param blob The blob to be uploaded
 * @param signer An async function used for signing nostr events
 * @returns The BlobDescriptor if successful
 */
export async function multiServerUpload<S extends ServerType, B extends UploadType>(
  servers: Iterable<S>,
  blob: B,
  opts?: MultiServerUploadOptions<S, B>,
) {
  let initialUpload: BlobDescriptor | undefined;
  const results = new Map<S, BlobDescriptor>();

  // reuse auth events
  let authEvents = opts?.auth ? [opts?.auth] : [];
  const handleAuthRequest = async (server: S) => {
    // check if any existing auth events match
    for (const auth of authEvents) {
      if (await doseAuthMatchUpload(auth, server, blob)) return auth;
    }

    // create a new auth event
    if (opts?.onAuth) {
      const auth = await opts.onAuth(server, blob);
      authEvents.push(auth);
      return auth;
    } else throw new Error("Missing onAuth handler");
  };

  // handle payment requests for servers
  const handlePaymentRequest = async (server: S, _b: any, request: PaymentRequest) => {
    if (!opts?.onPayment) throw new Error("Missing payment handler");

    return opts.onPayment(server, blob, request);
  };

  // start server uploads
  for (const server of servers) {
    try {
      let metadata: BlobDescriptor | undefined = undefined;

      opts?.onStart?.(server, blob);

      // attempt to mirror the blob
      if (initialUpload) {
        try {
          metadata = await mirrorBlob(server, initialUpload, {
            signal: opts?.signal,
            onAuth: handleAuthRequest,
            onPayment: handlePaymentRequest,
          });
        } catch (error) {}
      }

      if (!metadata) {
        metadata = await uploadBlob(server, blob, {
          onAuth: handleAuthRequest,
          onPayment: handlePaymentRequest,
        });

        // save first upload
        if (!initialUpload) initialUpload = metadata;
      }

      // save result
      results.set(server, metadata);

      // finished upload to server
      opts?.onUpload?.(server, blob);
    } catch (error) {
      // failed to upload to server
      if (error instanceof Error) opts?.onError?.(server, blob, error);
    }
  }

  return results;
}
