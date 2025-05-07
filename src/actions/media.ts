import { ServerType, UploadType } from "../client.js";
import { BlobDescriptor } from "../types.js";
import { getBlobSha256, getBlobSize, getBlobType } from "../helpers/index.js";
import HTTPError from "../error.js";
import { encodeAuthorizationHeader } from "../auth.js";
import { UploadOptions } from "./upload.js";

/** Error thrown when /media endpoint is not present on a server */
export class MediaEndpointMissingError extends Error {}

export type UploadMediaOptions<S extends ServerType, B extends UploadType> = UploadOptions<S, B>;

/** Upload a media blob to a server using the /media endpoint, handles payment and auth */
export async function uploadMedia<S extends ServerType, B extends UploadType>(
  server: S,
  blob: B,
  opts?: UploadMediaOptions<S, B>,
): Promise<BlobDescriptor> {
  const url = new URL("/media", server);
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

  // check upload with HEAD /media
  let firstTry = await fetch(url, {
    method: "HEAD",
    signal: opts?.signal,
    headers: checkHeaders,
  });

  let upload: Response | undefined = undefined;

  if (firstTry.status === 404) {
    // HEAD endpoint is not supported. abort
    throw new MediaEndpointMissingError("/media endpoint not supported");
  }

  // handle auth and payment
  switch (firstTry.status) {
    case 401: {
      const auth = opts?.auth || (await opts?.onAuth?.(server, sha256, "media", blob));
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
    case 402: {
      if (!opts?.onPayment) throw new Error("Missing payment handler");
      const { getEncodedToken } = await import("@cashu/cashu-ts");
      const { getPaymentRequestFromHeaders } = await import("../helpers/cashu.js");
      const request = getPaymentRequestFromHeaders(firstTry.headers);

      const token = await opts.onPayment(server, sha256, blob, request);
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
  }

  if (firstTry.status >= 500) throw new Error("Server error");

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

  // return blob descriptor
  return upload.json();
}
