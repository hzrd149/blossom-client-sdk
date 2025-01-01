import { doseAuthMatchUpload } from "../auth.js";
import { ServerType, UploadType } from "../client.js";
import { getBlobSha256 } from "../helpers.js";
import { BlobDescriptor, PaymentRequest } from "../types.js";
import { MediaEndpointMissingError, uploadMedia } from "./media.js";
import { mirrorBlob } from "./mirror.js";
import { uploadBlob, UploadOptions } from "./upload.js";

export type MultiServerUploadOptions<S extends ServerType, B extends UploadType> = UploadOptions<S, B> & {
  /**
   * Signals this blob should be treated as a media file and should attempt to use BUD-05 /media endpoint for upload on first server
   * @default false
   */
  isMedia?: boolean;
  /**
   * If isMedia is enabled, this determines how /media endpoints should be prioritized
   *  - "first" Only use the first server in the list to optimize the media
   *  - "any" Use any server in the list to optimize the media
   * @default "first"
   */
  mediaUploadBehavior?: "first" | "any";
  /**
   * If isMedia is enabled, should the raw blob be uploaded if no /media endpoint can be found
   * @default false
   */
  mediaUploadFallback?: boolean;
  /**
   * called on blob when uploaded to started to a server
   * @param server
   * @param sha256 the hash of the blob being uploaded or mirrored
   * @param blob the original blob
   */
  onStart?: (server: S, sha256: string, blob: B) => void;
  /** called when upload to a server is complete */
  onUpload?: (server: S, sha256: string, blob: B) => void;
  /** called when upload to a server fails */
  onError?: (server: S, sha256: string, blob: B, error: Error) => void;
};

/**
 * Creates an AsyncGenerator that can be used to upload a blob to multiple servers
 * @param servers A Set or Array of servers to upload to
 * @param blob The blob to be uploaded
 * @param signer An async function used for signing nostr events
 * @returns The BlobDescriptor if successful
 *
 * ```mermaid
 * flowchart LR
 *   isMedia{"isMedia"} -- yes --> media["/media"]
 *   isMedia -- no --> upload["/upload"]
 *   media --> ifmedia{"Successful"}
 *   ifmedia -- yes --> next["Next server"]
 *   ifmedia -- no --> iffallback{"fallback"}
 *   iffallback -- yes --> upload
 *   iffallback -- no --> abort
 *   upload -- complete --> next
 *   next --> uploaded{"Uploaded"}
 *   uploaded -- yes --> mirror["/mirror"]
 *   uploaded -- no --> upload
 *   mirror --> isMirror{"Successful"}
 *   isMirror -- yes --> next
 *   isMirror -- no --> ifMediaAbort{"isMedia"}
 *   ifMediaAbort -- no --> upload
 *   ifMediaAbort -- yes --> next
 * ```
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
  const handleAuthRequest = async (server: S, sha256: string, type: "upload" | "media") => {
    // check if any existing auth events match
    for (const auth of authEvents) {
      if (await doseAuthMatchUpload(auth, server, sha256)) return auth;
    }

    // create a new auth event
    if (opts?.onAuth) {
      const auth = await opts.onAuth(server, sha256, type, blob);
      authEvents.push(auth);
      return auth;
    } else throw new Error("Missing onAuth handler");
  };

  // handle payment requests for servers
  const handlePaymentRequest = async (server: S, sha256: string, _blog: any, request: PaymentRequest) => {
    if (!opts?.onPayment) throw new Error("Missing payment handler");

    return opts.onPayment(server, sha256, blob, request);
  };

  // servers to upload the blob to
  const uploadServers = Array.from(servers);

  // start media upload
  if (opts?.isMedia) {
    const mediaServers = opts.mediaUploadBehavior === "any" ? Array.from(servers) : [Array.from(servers)[0]];

    for (const server of mediaServers) {
      try {
        const sha256 = await getBlobSha256(blob);
        opts?.onStart?.(server, sha256, blob);

        // attempt to upload media
        initialUpload = await uploadMedia(server, blob, {
          onAuth: handleAuthRequest,
          onPayment: handlePaymentRequest,
        });

        // save result
        results.set(server, initialUpload);

        // finished upload to server
        opts?.onUpload?.(server, initialUpload.sha256, blob);
      } catch (error) {
        if (error instanceof MediaEndpointMissingError) {
          // ignore error
        } else if (error instanceof Error) {
          const sha256 = await getBlobSha256(blob);
          opts?.onError?.(server, sha256, blob, error);
        }
      }

      if (initialUpload) {
        // remove server from upload array
        if (uploadServers.includes(server)) uploadServers.splice(uploadServers.indexOf(server), 1);

        // exit on first successful media upload
        break;
      }
    }

    if (!opts.mediaUploadFallback && !initialUpload) {
      // failed to find a /media endpoint, abort
      throw new Error("Failed to find media processing endpoint");
    }
  }

  // start server uploads
  for (const server of uploadServers) {
    try {
      let metadata: BlobDescriptor | undefined = undefined;

      // attempt to mirror the initial upload
      if (initialUpload) {
        try {
          opts?.onStart?.(server, initialUpload.sha256, blob);

          metadata = await mirrorBlob(server, initialUpload, {
            signal: opts?.signal,
            onAuth: (server, sha256) => handleAuthRequest(server, sha256, "upload"),
            onPayment: handlePaymentRequest,
          });
        } catch (error) {
          // mirror failed, if isMedia skip server since we don't want to upload two versions of the blob
          if (opts?.isMedia) continue;
        }
      }

      // attempt to upload
      if (!metadata) {
        const sha256 = await getBlobSha256(blob);
        opts?.onStart?.(server, sha256, blob);

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
      opts?.onUpload?.(server, metadata.sha256, blob);
    } catch (error) {
      // failed to upload to server
      if (error instanceof Error) opts?.onError?.(server, await getBlobSha256(blob), blob, error);
    }
  }

  return results;
}
