import { getReusableAuthEvent, storeAuthEvent } from "../auth.js";
import { ServerType, UploadType } from "../types.js";
import { getBlobSha256 } from "../helpers/index.js";
import { BlobDescriptor, PaymentRequest, RejectionAction, SignedEvent } from "../types.js";
import HTTPError from "../error.js";
import { MediaEndpointMissingError, uploadMedia } from "./media.js";
import { mirrorBlob } from "./mirror.js";
import { hasBlob } from "./has.js";
import { uploadBlob, UploadOptions } from "./upload.js";

export type MultiServerUploadOptions<TServer extends ServerType, TUpload extends UploadType> = UploadOptions<
  TServer,
  TUpload
> & {
  /**
   * Timeout for mirror requests
   * @default 5000
   */
  mirrorTimeout?: number;
  /**
   * Run parallel HEAD /<sha256> checks on all servers before starting uploads.
   * Servers that already have the blob will use /mirror to register ownership instead of /upload.
   * @default true
   */
  preflight?: boolean;
  /**
   * called on blob when uploaded to started to a server
   * @param server
   * @param sha256 the hash of the blob being uploaded or mirrored
   * @param blob the original blob
   */
  onStart?: (server: TServer, sha256: string, blob: TUpload) => void;
  /** called when upload to a server is complete */
  onUpload?: (server: TServer, sha256: string, blob: TUpload) => void;
  /** called when upload to a server fails */
  onError?: (server: TServer, sha256: string, blob: TUpload, error: Error) => void;
  /**
   * Called when a server rejects the upload with a known BUD-02 status (409, 413, 415, 422).
   * Return "skip" to skip this server and continue, or "cancel" to abort the entire upload.
   * If not provided, rejections are reported via onError.
   */
  onRejection?: (
    server: TServer,
    sha256: string,
    blob: TUpload,
    error: HTTPError,
  ) => RejectionAction | Promise<RejectionAction>;
};

export type MultiServerMediaUploadOptions<
  TServer extends ServerType,
  TUpload extends UploadType,
> = MultiServerUploadOptions<TServer, TUpload> & {
  /**
   * Determines how /media endpoints should be prioritized
   *  - "first" Only use the first server in the list to optimize the media
   *  - "any" Use any server in the list to optimize the media
   * @default "first"
   */
  mediaUploadBehavior?: "first" | "any";
  /**
   * Should the raw blob be uploaded if no /media endpoint can be found
   * @default false
   */
  mediaUploadFallback?: boolean;
};

const defaultMultiServerOptions: MultiServerUploadOptions<any, any> = {
  mirrorTimeout: 5000,
  preflight: true,
};

const defaultMediaUploadOptions: MultiServerMediaUploadOptions<any, any> = {
  ...defaultMultiServerOptions,
  mediaUploadBehavior: "first",
  mediaUploadFallback: false,
};

/**
 * Upload a blob to multiple servers
 *
 * Uploads the blob to the first server, then mirrors to the remaining servers.
 * Uses parallel preflight checks (HEAD /<sha256>) to detect which servers already have the blob.
 *
 * ```mermaid
 * flowchart LR
 *   preflight["HEAD /<sha256>"] --> hasBlob{"Has blob?"}
 *   hasBlob -- yes --> mirror["/mirror"]
 *   hasBlob -- no --> upload["/upload"]
 *   upload -- complete --> next["Next server"]
 *   next --> hasBlob
 *   mirror --> isMirror{"Successful?"}
 *   isMirror -- yes --> next
 *   isMirror -- no --> upload
 * ```
 */
export async function multiServerUpload<S extends ServerType, B extends UploadType>(
  servers: Iterable<S>,
  blob: B,
  opts?: MultiServerUploadOptions<S, B>,
) {
  const options = { ...defaultMultiServerOptions, ...opts };
  let initialUpload: BlobDescriptor | undefined;
  const results = new Map<S, BlobDescriptor>();
  const authEvents = options.authEvents ?? new Set<SignedEvent>();
  const blobSha256 = await getBlobSha256(blob);

  if (typeof options.auth === "object") authEvents.add(options.auth);

  const handleAuthRequest = async (server: S, sha256: string, type: "upload" | "media") => {
    const reused = await getReusableAuthEvent(authEvents, { server, type, blob: sha256 });
    if (reused) return reused;

    if (options.onAuth) {
      const auth = await options.onAuth(server, sha256, type, blob);
      return storeAuthEvent(authEvents, auth);
    } else throw new Error("Missing onAuth handler");
  };

  const handlePaymentRequest = async (server: S, sha256: string, _blob: any, request: PaymentRequest) => {
    if (!options.onPayment) throw new Error("Missing payment handler");
    return options.onPayment(server, sha256, blob, request);
  };
  const handlePaymentRequired = (server: S, sha256: string, _blob: any, headers: Headers) => {
    if (!options.onPaymentRequired) throw new Error("Missing payment handler");
    return options.onPaymentRequired(server, sha256, blob, headers);
  };

  const handleRejection = async (server: S, sha256: string, error: unknown): Promise<RejectionAction | false> => {
    if (!HTTPError.isRejection(error)) return false;

    if (options.onRejection) {
      return await options.onRejection(server, sha256, blob, error);
    }

    options.onError?.(server, sha256, blob, error);
    return "skip";
  };

  const uploadServers = Array.from(servers);

  // parallel preflight: check which servers already have the blob
  const serversWithBlob = new Set<S>();
  if (options.preflight !== false && uploadServers.length > 0) {
    const preflightResults = await Promise.allSettled(
      uploadServers.map(async (server) => {
        const exists = await hasBlob(server, blobSha256, {
          signal: options.signal,
          timeout: options.mirrorTimeout,
        });
        return { server, exists };
      }),
    );

    for (const result of preflightResults) {
      if (result.status === "fulfilled" && result.value.exists) {
        serversWithBlob.add(result.value.server);
      }
    }
  }

  // upload to each server
  for (const server of uploadServers) {
    const serverHasBlob = serversWithBlob.has(server);

    try {
      let metadata: BlobDescriptor | undefined = undefined;

      // attempt to mirror if we have an initial upload or server already has the blob
      if (initialUpload || serverHasBlob) {
        const mirrorSource = initialUpload ?? {
          url: new URL("/" + blobSha256, server).toString(),
          sha256: blobSha256,
          size: 0,
          uploaded: 0,
        };

        try {
          options.onStart?.(server, blobSha256, blob);

          metadata = await mirrorBlob(server, mirrorSource, {
            signal: options.signal,
            auth: typeof options.auth === "boolean" ? options.auth : undefined,
            onAuth: (server, sha256) => handleAuthRequest(server, sha256, "upload"),
            onPayment: handlePaymentRequest,
            onPaymentRequired: options.onPaymentRequired ? handlePaymentRequired : undefined,
            timeout: options.mirrorTimeout,
          });
        } catch (error) {
          // mirror failed, if server already has blob skip upload fallback
          if (serverHasBlob) continue;
        }
      }

      // attempt to upload if mirror failed
      if (!metadata) {
        options.onStart?.(server, blobSha256, blob);

        metadata = await uploadBlob(server, blob, {
          signal: options.signal,
          auth: typeof options.auth === "boolean" ? options.auth : undefined,
          onAuth: handleAuthRequest,
          onPayment: handlePaymentRequest,
          onPaymentRequired: options.onPaymentRequired ? handlePaymentRequired : undefined,
          timeout: options.mirrorTimeout,
        });

        if (!initialUpload) initialUpload = metadata;
      }

      results.set(server, metadata);
      options.onUpload?.(server, metadata.sha256, blob);
    } catch (error) {
      const rejection = await handleRejection(server, blobSha256, error);
      if (rejection === "cancel") return results;
      if (!rejection && error instanceof Error) options.onError?.(server, blobSha256, blob, error);
    }
  }

  return results;
}

/**
 * Upload media to multiple servers using BUD-05 optimization
 *
 * Uploads the blob to a /media endpoint on one server for optimization,
 * then mirrors the optimized result to the remaining servers.
 * The blob is never re-uploaded to other servers since the /media endpoint may transform it.
 *
 * ```mermaid
 * flowchart LR
 *   media["/media"] --> ifmedia{"Successful?"}
 *   ifmedia -- yes --> preflight["HEAD /<sha256>"]
 *   ifmedia -- no --> iffallback{"fallback?"}
 *   iffallback -- yes --> upload["multiServerUpload"]
 *   iffallback -- no --> abort
 *   preflight --> mirror["/mirror"]
 *   mirror --> next["Next server"]
 * ```
 */
export async function multiServerMediaUpload<S extends ServerType, B extends UploadType>(
  servers: Iterable<S>,
  blob: B,
  opts?: MultiServerMediaUploadOptions<S, B>,
) {
  const options = { ...defaultMediaUploadOptions, ...opts };
  let initialUpload: BlobDescriptor | undefined;
  const results = new Map<S, BlobDescriptor>();
  const authEvents = options.authEvents ?? new Set<SignedEvent>();
  const blobSha256 = await getBlobSha256(blob);

  if (typeof options.auth === "object") authEvents.add(options.auth);

  const handleAuthRequest = async (server: S, sha256: string, type: "upload" | "media") => {
    const reused = await getReusableAuthEvent(authEvents, { server, type, blob: sha256 });
    if (reused) return reused;

    if (options.onAuth) {
      const auth = await options.onAuth(server, sha256, type, blob);
      return storeAuthEvent(authEvents, auth);
    } else throw new Error("Missing onAuth handler");
  };

  const handlePaymentRequest = async (server: S, sha256: string, _blob: any, request: PaymentRequest) => {
    if (!options.onPayment) throw new Error("Missing payment handler");
    return options.onPayment(server, sha256, blob, request);
  };
  const handlePaymentRequired = (server: S, sha256: string, _blob: any, headers: Headers) => {
    if (!options.onPaymentRequired) throw new Error("Missing payment handler");
    return options.onPaymentRequired(server, sha256, blob, headers);
  };

  const handleRejection = async (server: S, sha256: string, error: unknown): Promise<RejectionAction | false> => {
    if (!HTTPError.isRejection(error)) return false;

    if (options.onRejection) {
      return await options.onRejection(server, sha256, blob, error);
    }

    options.onError?.(server, sha256, blob, error);
    return "skip";
  };

  const allServers = Array.from(servers);
  const mediaServers = options.mediaUploadBehavior === "any" ? Array.from(allServers) : [allServers[0]];
  let mediaUploadServer: S | undefined;

  // phase 1: upload to /media on one server for optimization
  for (const server of mediaServers) {
    try {
      options.onStart?.(server, blobSha256, blob);

      initialUpload = await uploadMedia(server, blob, {
        signal: options.signal,
        auth: typeof options.auth === "boolean" ? options.auth : undefined,
        onAuth: handleAuthRequest,
        onPayment: handlePaymentRequest,
        onPaymentRequired: options.onPaymentRequired ? handlePaymentRequired : undefined,
      });

      results.set(server, initialUpload);
      mediaUploadServer = server;
      options.onUpload?.(server, initialUpload.sha256, blob);
    } catch (error) {
      if (error instanceof MediaEndpointMissingError) {
        // ignore, try next server
      } else {
        const rejection = await handleRejection(server, blobSha256, error);
        if (rejection === "cancel") return results;
        if (!rejection && error instanceof Error) {
          options.onError?.(server, blobSha256, blob, error);
        }
      }
    }

    if (initialUpload) break;
  }

  // if no /media endpoint found, fall back to regular upload or abort
  if (!initialUpload) {
    if (!options.mediaUploadFallback) {
      throw new Error("Failed to find media processing endpoint");
    }

    // fall back to regular multi-server upload
    return multiServerUpload(servers, blob, options);
  }

  // phase 2: mirror the optimized blob to remaining servers
  const remainingServers = allServers.filter((s) => s !== mediaUploadServer);

  // parallel preflight on remaining servers using the optimized blob's sha256
  const serversWithBlob = new Set<S>();
  if (options.preflight !== false && remainingServers.length > 0) {
    const preflightResults = await Promise.allSettled(
      remainingServers.map(async (server) => {
        const exists = await hasBlob(server, initialUpload!.sha256, {
          signal: options.signal,
          timeout: options.mirrorTimeout,
        });
        return { server, exists };
      }),
    );

    for (const result of preflightResults) {
      if (result.status === "fulfilled" && result.value.exists) {
        serversWithBlob.add(result.value.server);
      }
    }
  }

  // mirror to remaining servers
  for (const server of remainingServers) {
    try {
      options.onStart?.(server, initialUpload.sha256, blob);

      const metadata = await mirrorBlob(server, initialUpload, {
        signal: options.signal,
        auth: typeof options.auth === "boolean" ? options.auth : undefined,
        onAuth: (server, sha256) => handleAuthRequest(server, sha256, "upload"),
        onPayment: handlePaymentRequest,
        onPaymentRequired: options.onPaymentRequired ? handlePaymentRequired : undefined,
        timeout: options.mirrorTimeout,
      });

      results.set(server, metadata);
      options.onUpload?.(server, metadata.sha256, blob);
    } catch (error) {
      const rejection = await handleRejection(server, initialUpload.sha256, error);
      if (rejection === "cancel") return results;
      if (!rejection && error instanceof Error) options.onError?.(server, initialUpload.sha256, blob, error);
    }
  }

  return results;
}
