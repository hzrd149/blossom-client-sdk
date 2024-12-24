import { getBlobSha256 } from "./helpers.js";
import {
  createDeleteAuth,
  createDownloadAuth,
  createListAuth,
  createUploadAuth,
  encodeAuthorizationHeader,
} from "./auth.js";
import { BlobDescriptor, PaymentHandlers as PaymentHandler, SignedEvent, Signer } from "./types.js";
import { mirrorBlob, MirrorOptions } from "./actions/mirror.js";
import { uploadBlob, UploadOptions } from "./actions/upload.js";
import { listBlobs, ListOptions } from "./actions/list.js";
import { downloadBlob, DownloadOptions } from "./actions/download.js";
import { deleteBlob, DeleteOptions } from "./actions/delete.js";
import { uploadMedia } from "./actions/media.js";

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
  async createDownloadAuth(message: string, hash: string, expiration?: number) {
    if (!this.signer) throw new Error("Missing signer");
    return await createDownloadAuth(this.signer, hash, message, expiration);
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
      if (typeof opts?.auth === "object") options.auth = opts.auth;
      if (this.signer) options.auth = await this.createDownloadAuth(`Download ${hash}`, hash);
    }

    // attach payment
    if (opts?.payment !== false && this.payment) options.onPayment = this.payment.download;

    const download = await downloadBlob(this.server, hash, options);
    return download.blob();
  }

  // upload blob
  async createUploadAuth(blob: UploadType, message?: string, expiration?: number) {
    if (!this.signer) throw new Error("Missing signer");
    const hash = await getBlobSha256(blob);
    return await createUploadAuth(this.signer, hash, message, expiration);
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
      if (typeof opts?.auth === "object") options.auth = opts.auth;
      if (this.signer) options.auth = await this.createUploadAuth(blob);
    }

    // attach payment
    if (opts?.payment !== false && this.payment) options.onPayment = this.payment.upload;

    return uploadBlob(this.server, blob, options);
  }

  // mirror blob
  async createMirrorAuth(blob: string | BlobDescriptor, message?: string, expiration?: number) {
    if (!this.signer) throw new Error("Missing signer");
    return await createUploadAuth(this.signer, typeof blob === "string" ? blob : blob.sha256, message, expiration);
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
      if (typeof opts?.auth === "object") options.auth = opts.auth;
      if (this.signer) options.auth = await this.createMirrorAuth(blob);
    }

    // attach payment
    if (opts?.payment !== false && this.payment) options.onPayment = this.payment.mirror;

    return mirrorBlob(this.server, blob, options);
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
  async createListAuth(message?: string, expiration?: number) {
    if (!this.signer) throw new Error("Missing signer");
    return await createListAuth(this.signer, message, expiration);
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
      if (typeof opts?.auth === "object") options.auth = opts.auth;
      if (this.signer) options.auth = await this.createListAuth();
    }

    // attach payment
    if (opts?.payment !== false && this.payment) options.onPayment = this.payment.list;

    return listBlobs(this.server, pubkey, options);
  }

  // delete blob
  async createDeleteAuth(hash: string, message?: string, expiration?: number) {
    if (!this.signer) throw new Error("Missing signer");
    return await createDeleteAuth(this.signer, hash, message, expiration);
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
      if (typeof opts?.auth === "object") options.auth = opts.auth;
      if (this.signer) options.auth = await this.createListAuth();
    }

    // attach payment
    if (opts?.payment !== false && this.payment) options.onPayment = this.payment.delete;

    return BlossomClient.deleteBlob(this.server, hash, options);
  }
}
