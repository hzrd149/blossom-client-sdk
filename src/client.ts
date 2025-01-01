import { getBlobSha256 } from "./helpers.js";
import {
  createDeleteAuth,
  createDownloadAuth,
  createListAuth,
  createMirrorAuth,
  createUploadAuth,
  DeleteAuthOptions,
  DownloadAuthOptions,
  encodeAuthorizationHeader,
  ListAuthOptions,
  MirrorAuthOptions,
  UploadAuthOptions,
} from "./auth.js";
import { BlobDescriptor, PaymentHandlers as PaymentHandler, SignedEvent, Signer } from "./types.js";
import { mirrorBlob, MirrorOptions } from "./actions/mirror.js";
import { uploadBlob, UploadOptions } from "./actions/upload.js";
import { listBlobs, ListOptions } from "./actions/list.js";
import { downloadBlob, DownloadOptions } from "./actions/download.js";
import { deleteBlob, DeleteOptions } from "./actions/delete.js";
import { uploadMedia, UploadMediaOptions } from "./actions/media.js";

export type ServerType = string | URL;
export type UploadType = Blob | File | Buffer;

export class BlossomClient {
  server: URL;
  signer?: Signer;
  payment?: PaymentHandler<URL>;

  constructor(server: string | URL, signer?: Signer) {
    this.server = new URL("/", server);
    this.signer = signer;
  }

  // moved to helpers.ts
  static getFileSha256 = getBlobSha256;

  // static auth methods moved to auth.ts
  static createGetAuth = createDownloadAuth;
  static createUploadAuth = createUploadAuth;
  static createListAuth = createListAuth;
  static createDeleteAuth = createDeleteAuth;

  // util
  static encodeAuthorizationHeader = encodeAuthorizationHeader;

  // static blob methods moved to actions
  static mirrorBlob = mirrorBlob;
  static uploadBlob = uploadBlob;
  static listBlobs = listBlobs;
  static downloadBlob = downloadBlob;
  static deleteBlob = deleteBlob;
  static uploadMedia = uploadMedia;

  // download blob
  async createDownloadAuth(hash: string, options?: DownloadAuthOptions) {
    if (!this.signer) throw new Error("Missing signer");
    return await createDownloadAuth(this.signer, hash, options);
  }
  async downloadBlob(
    hash: string,
    opts?: Omit<DownloadOptions<URL>, "onAuth" | "onPayment" | "auth"> & {
      auth?: SignedEvent | boolean;
      payment?: boolean;
    },
  ) {
    const options: DownloadOptions<URL> = { signal: opts?.signal };

    // attach auth
    if (opts?.auth !== false) {
      if (this.signer)
        options.onAuth = (_server, sha256) => this.createDownloadAuth(sha256, { message: `Download ${sha256}` });
      if (typeof opts?.auth === "object") options.auth = opts.auth;
    }

    // attach payment
    if (opts?.payment !== false && this.payment) options.onPayment = this.payment.download;

    const download = await downloadBlob(this.server, hash, options);
    return download.blob();
  }

  // upload blob
  async createUploadAuth(blob: string | UploadType, options?: UploadAuthOptions) {
    if (!this.signer) throw new Error("Missing signer");
    return await createUploadAuth(this.signer, blob, options);
  }
  async uploadBlob<B extends UploadType>(
    blob: B,
    opts?: Omit<UploadOptions<URL, B>, "onAuth" | "onPayment" | "auth"> & {
      auth?: SignedEvent | boolean;
      payment?: boolean;
    },
  ) {
    const options: UploadOptions<URL, B> = { signal: opts?.signal };

    // attach auth
    if (opts?.auth !== false) {
      if (this.signer) options.onAuth = (_server, sha256, type) => this.createUploadAuth(sha256, { type });
      if (typeof opts?.auth === "object") options.auth = opts.auth;
    }

    // attach payment
    if (opts?.payment !== false && this.payment) options.onPayment = this.payment.upload;

    return uploadBlob(this.server, blob, options);
  }

  // mirror blob
  async createMirrorAuth(blob: string | BlobDescriptor, options?: MirrorAuthOptions) {
    if (!this.signer) throw new Error("Missing signer");
    return await createMirrorAuth(this.signer, typeof blob === "string" ? blob : blob.sha256, options);
  }
  async mirrorBlob(
    blob: BlobDescriptor,
    opts?: Omit<MirrorOptions<URL>, "onAuth" | "onPayment" | "auth"> & {
      auth?: SignedEvent | boolean;
      payment?: boolean;
    },
  ) {
    const options: MirrorOptions<URL> = { signal: opts?.signal };

    // attach auth
    if (opts?.auth !== false) {
      if (this.signer) options.onAuth = (_server, sha256) => this.createMirrorAuth(sha256);
      if (typeof opts?.auth === "object") options.auth = opts.auth;
    }

    // attach payment
    if (opts?.payment !== false && this.payment) options.onPayment = this.payment.mirror;

    return mirrorBlob(this.server, blob, options);
  }

  // upload media
  async createMediaAuth(blob: string | UploadType, options?: Omit<UploadAuthOptions, "type">) {
    return await this.createUploadAuth(blob, { ...options, type: "media" });
  }
  async uploadMedia<B extends UploadType>(
    blob: B,
    opts?: Omit<UploadMediaOptions<URL, B>, "onAuth" | "onPayment" | "auth"> & {
      auth?: SignedEvent | boolean;
      payment?: boolean;
    },
  ) {
    const options: UploadMediaOptions<URL, B> = { signal: opts?.signal };

    // attach auth
    if (opts?.auth !== false) {
      if (this.signer) options.onAuth = (_server, sha256, type) => this.createUploadAuth(sha256, { type });
      if (typeof opts?.auth === "object") options.auth = opts.auth;
    }

    // attach payment
    if (opts?.payment !== false && this.payment) options.onPayment = this.payment.upload;

    return uploadMedia(this.server, blob, options);
  }

  // has blob
  static async hasBlob(server: ServerType, hash: string) {
    const res = await fetch(new URL(`/` + hash, server), { method: "HEAD" });
    return res.status !== 404;
  }
  async hasBlob(hash: string) {
    return BlossomClient.hasBlob(this.server, hash);
  }

  // list blobs
  async createListAuth(options?: ListAuthOptions) {
    if (!this.signer) throw new Error("Missing signer");
    return await createListAuth(this.signer, options);
  }
  async listBlobs(
    pubkey: string,
    opts?: Omit<ListOptions<URL>, "onAuth" | "onPayment" | "auth"> & {
      auth?: SignedEvent | boolean;
      payment?: boolean;
    },
  ) {
    const options: ListOptions<URL> = { signal: opts?.signal };

    // attach auth
    if (opts?.auth !== false) {
      if (this.signer) options.onAuth = (_server) => this.createListAuth();
      if (typeof opts?.auth === "object") options.auth = opts.auth;
    }

    // attach payment
    if (opts?.payment !== false && this.payment) options.onPayment = this.payment.list;

    return listBlobs(this.server, pubkey, options);
  }

  // delete blob
  async createDeleteAuth(blob: string | UploadType, options?: DeleteAuthOptions) {
    if (!this.signer) throw new Error("Missing signer");
    return await createDeleteAuth(this.signer, blob, options);
  }
  async deleteBlob(
    hash: string,
    opts?: Omit<DeleteOptions<URL>, "onAuth" | "onPayment" | "auth"> & {
      auth?: SignedEvent | boolean;
      payment?: boolean;
    },
  ) {
    const options: DeleteOptions<URL> = { signal: opts?.signal };

    // attach auth
    if (opts?.auth !== false) {
      if (this.signer) options.onAuth = (_server, sha256) => this.createDeleteAuth(sha256);
      if (typeof opts?.auth === "object") options.auth = opts.auth;
    }

    // attach payment
    if (opts?.payment !== false && this.payment) options.onPayment = this.payment.delete;

    return BlossomClient.deleteBlob(this.server, hash, options);
  }
}
