import { encodeAuthorizationHeader, getReusableAuthEvent, storeAuthEvent } from "../auth.js";
import { ServerType, UploadType } from "../types.js";
import HTTPError from "../error.js";
import { fetchWithTimeout, getBlobSha256, getBlobSize, getBlobType } from "../helpers/index.js";
import { mergeHeaders } from "../helpers/headers.js";
import { BlobDescriptor, PaymentRequest, PaymentToken, SignedEvent } from "../types.js";

export type UploadOptions<S extends ServerType, B extends UploadType> = {
  /** AbortSignal to cancel the action */
  signal?: AbortSignal;
  /** Override authorization event, or true to always use authorization, false to disable authorization */
  auth?: SignedEvent | boolean;
  /** Shared auth event store used to reuse non-expired auth events between requests */
  authEvents?: Set<SignedEvent>;
  /** Request timeout */
  timeout?: number;
  /** Return headers to retry a request rejected with HTTP 402. */
  onPaymentRequired?: (server: S, sha256: string, blob: B, headers: Headers) => Promise<HeadersInit>;
  /**
   * A method used to request payment when uploading or mirroring a blob
   * @param server the server requiring payment
   * @param sha256 the sha256 of the blob being uploaded or mirrored
   * @param blob the original blob
   * @param request the payment request
   */
  /** @deprecated Use onPaymentRequired to handle payment schemes generically. */
  onPayment?: (server: S, sha256: string, blob: B, request: PaymentRequest) => Promise<PaymentToken>;
  /**
   * A method used to request a signed auth event for a server and sha256
   * @param server the server requesting the auth
   * @param sha256 the sha256 of the blob being upload or mirror to the server
   * @param blob the original blob passed to the method
   */
  onAuth?: (server: S, sha256: string, authType: "upload" | "media", blob: B) => Promise<SignedEvent>;
};

/** Upload a blob to a server, handles payment and auth */
export async function uploadBlob<S extends ServerType, B extends UploadType>(
  server: S,
  blob: B,
  opts?: UploadOptions<S, B>,
): Promise<BlobDescriptor> {
  const url = new URL("/upload", server);
  const sha256 = await getBlobSha256(blob);
  const resolveAuth = async (preset: boolean = false) => {
    const reused = opts?.authEvents
      ? await getReusableAuthEvent(opts.authEvents, { server, type: "upload", blob: sha256 })
      : undefined;
    if (reused) return reused;

    const auth = await opts?.onAuth?.(server, sha256, "upload", blob);
    if (!auth) throw new Error(preset ? "Missing onAuth handler" : "Missing auth handler");

    if (opts?.authEvents) storeAuthEvent(opts.authEvents, auth);
    return auth;
  };

  const headers: Record<string, string> = {
    "X-SHA-256": sha256,
  };

  // attach the authorization if its already set
  if (opts?.auth) {
    if (typeof opts.auth === "boolean") {
      headers["Authorization"] = encodeAuthorizationHeader(await resolveAuth(true));
    } else {
      headers["Authorization"] = encodeAuthorizationHeader(opts.auth);
    }
  }

  // build check headers
  const checkHeaders: Record<string, string> = {
    ...headers,
    "X-Content-Length": String(getBlobSize(blob)),
  };
  const type = getBlobType(blob);
  if (type) checkHeaders["X-Content-Type"] = type;

  // check upload with HEAD /upload
  let firstTry = await fetchWithTimeout(url, {
    method: "HEAD",
    signal: opts?.signal,
    headers: checkHeaders,
    timeout: opts?.timeout,
  });

  let upload: Response | undefined = undefined;

  if (firstTry.status === 404) {
    // BUD-06 HEAD endpoint is not supported. attempt to upload
    upload = firstTry = await fetchWithTimeout(url, {
      body: blob,
      method: "PUT",
      signal: opts?.signal,
      timeout: opts?.timeout,
    });
  }

  // handle auth and payment
  switch (firstTry.status) {
    case 401: {
      // throw an error if auth is requested and disabled
      if (opts?.auth === false) throw new Error("Authorization disabled");

      // Request authorization event for this upload
      const auth = await resolveAuth();

      // Try upload with auth
      upload = await fetchWithTimeout(url, {
        method: "PUT",
        body: blob,
        headers: { ...headers, Authorization: encodeAuthorizationHeader(auth) },
        signal: opts?.signal,
        timeout: opts?.timeout,
      });
      break;
    }
    case 402: {
      let paymentHeaders: HeadersInit;
      if (opts?.onPaymentRequired)
        paymentHeaders = await opts.onPaymentRequired(server, sha256, blob, firstTry.headers);
      else if (opts?.onPayment) {
        const { encodePaymentToken, getPaymentRequestFromHeaders } = await import("../helpers/cashu.js");
        const request = await getPaymentRequestFromHeaders(firstTry.headers);
        paymentHeaders = { "X-Cashu": encodePaymentToken(await opts.onPayment(server, sha256, blob, request)) };
      } else throw new Error("Missing payment handler");

      // Try upload with payment
      upload = await fetchWithTimeout(url, {
        method: "PUT",
        body: blob,
        headers: mergeHeaders(headers, paymentHeaders),
        signal: opts?.signal,
        timeout: opts?.timeout,
      });
      break;
    }
  }

  if (firstTry.status >= 500) throw new Error("Server error");

  // check passed, upload
  if (!upload)
    upload = await fetchWithTimeout(url, {
      method: "PUT",
      body: blob,
      headers: { ...headers },
      signal: opts?.signal,
      timeout: opts?.timeout,
    });

  // handle errors
  await HTTPError.handleErrorResponse(upload);

  // return blob descriptor
  return upload.json();
}
