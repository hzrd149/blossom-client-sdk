import { encodeAuthorizationHeader } from "../auth.js";
import { ServerType, UploadType } from "../client.js";
import HTTPError from "../error.js";
import {
  fetchWithTimeout,
  getBlobSha256,
  getBlobSize,
  getBlobType,
  getPaymentRequestFromHeaders,
} from "../helpers/index.js";
import { BlobDescriptor, PaymentRequest, PaymentToken, SignedEvent } from "../types.js";

export type UploadOptions<S extends ServerType, B extends UploadType> = {
  /** AbortSignal to cancel the action */
  signal?: AbortSignal;
  /** Override auth event to use */
  auth?: SignedEvent;
  /** Request timeout */
  timeout?: number;
  /**
   * A method used to request payment when uploading or mirroring a blob
   * @param server the server requiring payment
   * @param sha256 the sha256 of the blob being uploaded or mirrored
   * @param blob the original blob
   * @param request the payment request
   */
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

  const headers: Record<string, string> = {
    "X-SHA-256": sha256,
  };

  // attach the auth if its already set
  if (opts?.auth) headers["Authorization"] = encodeAuthorizationHeader(opts.auth);

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
      const auth = opts?.auth || (await opts?.onAuth?.(server, sha256, "upload", blob));
      if (!auth) throw new Error("Missing auth handler");

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
      if (!opts?.onPayment) throw new Error("Missing payment handler");
      const { getEncodedToken } = await import("@cashu/cashu-ts");
      const request = getPaymentRequestFromHeaders(firstTry.headers);

      const token = await opts.onPayment(server, sha256, blob, request);
      const payment = getEncodedToken(token);

      // Try upload with payment
      upload = await fetchWithTimeout(url, {
        method: "PUT",
        body: blob,
        headers: { ...headers, "X-Cashu": payment },
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
