import { bytesToHex } from "@noble/hashes/utils";

const now = () => Math.floor(new Date().valueOf() / 1000);
const oneHour = () => now() + 60 * 60;

export type EventTemplate = {
  created_at: number;
  kind: number;
  content: string;
  tags: string[][];
};
export type SignedEvent = EventTemplate & {
  id: string;
  sig: string;
  pubkey: string;
};

/** An async method used to sign nostr events */
export type Signer = (draft: EventTemplate) => Promise<SignedEvent>;

export const AUTH_EVENT_KIND = 24242;

export type BlobDescriptor = {
  /** @deprecated use uploaded instead */
  created?: number;
  uploaded: number;
  type?: string;
  sha256: string;
  size: number;
  url: string;
};

export class HTTPError extends Error {
  response: Response;
  status: number;
  body?: { message: string };

  constructor(response: Response, body: { message: string } | string) {
    super(typeof body === "string" ? body : body.message);
    this.response = response;
    this.status = response.status;

    if (typeof body == "object") this.body = body;
  }

  static async handleErrorResponse(res: Response) {
    if (!res.ok) {
      try {
        throw new HTTPError(res, await res.json());
      } catch (e) {
        if (e instanceof Error) throw new HTTPError(res, e.message);
      }
    }
  }
}

export type ServerType = string | URL;
export type UploadType = Blob | File | Buffer;

export class BlossomClient {
  server: URL;
  signer?: Signer;

  constructor(server: string | URL, signer?: Signer) {
    this.server = new URL("/", server);
    this.signer = signer;
  }

  static async getFileSha256(file: UploadType) {
    let buffer: ArrayBuffer;
    if (file instanceof File || file instanceof Blob) {
      buffer = await file.arrayBuffer();
    } else {
      // nodejs Buffer
      buffer = file.buffer;
    }

    let hash: Uint8Array;
    if (crypto.subtle) {
      const hashBuffer = await crypto.subtle.digest("SHA-256", buffer);
      hash = new Uint8Array(hashBuffer);
    } else {
      const { sha256 } = await import("@noble/hashes/sha256");
      hash = sha256.create().update(new Uint8Array(buffer)).digest();
    }

    return bytesToHex(hash);
  }

  static encodeAuthorizationHeader(event: SignedEvent) {
    return "Nostr " + btoa(JSON.stringify(event));
  }

  // static get blob
  static async getGetAuth(signer: Signer, message: string, serverOrHash: string, expiration = oneHour()) {
    let scopeTag: string[];
    if (serverOrHash.match(/^[0-9a-f]{64}$/)) {
      scopeTag = ["x", serverOrHash];
    } else scopeTag = ["server", new URL("/", serverOrHash).toString()];

    return await signer({
      created_at: now(),
      kind: AUTH_EVENT_KIND,
      content: message,
      tags: [["t", "get"], ["expiration", String(expiration)], scopeTag],
    });
  }
  static async getBlob(server: ServerType, hash: string, auth?: SignedEvent) {
    const res = await fetch(new URL(hash, server), {
      headers: auth ? { authorization: BlossomClient.encodeAuthorizationHeader(auth) } : {},
    });
    await HTTPError.handleErrorResponse(res);
    return await res.blob();
  }

  // static upload blob
  static async createUploadAuth(sha256: string, signer: Signer, message = "Upload Blob", expiration = oneHour()) {
    const tags: string[][] = [];
    tags.push(["t", "upload"]);
    tags.push(["x", sha256]);
    tags.push(["expiration", String(expiration)]);

    return await signer({
      created_at: now(),
      kind: AUTH_EVENT_KIND,
      content: message,
      tags,
    });
  }
  static async getUploadAuth(file: UploadType, signer: Signer, message = "Upload Blob", expiration = oneHour()) {
    const sha256 = await BlossomClient.getFileSha256(file);
    return await BlossomClient.createUploadAuth(sha256, signer, message, expiration);
  }
  static async uploadBlob(server: ServerType, file: UploadType, auth?: SignedEvent) {
    const res = await fetch(new URL("/upload", server), {
      method: "PUT",
      body: file,
      headers: auth ? { authorization: BlossomClient.encodeAuthorizationHeader(auth) } : {},
    });

    await HTTPError.handleErrorResponse(res);
    return (await res.json()) as Promise<BlobDescriptor>;
  }

  // static mirror blob
  static async mirrorBlob(server: ServerType, url: string | URL, auth?: SignedEvent) {
    const res = await fetch(new URL("/mirror", server), {
      method: "PUT",
      body: JSON.stringify({ url: url.toString() }),
      headers: auth ? { authorization: BlossomClient.encodeAuthorizationHeader(auth) } : {},
    });

    await HTTPError.handleErrorResponse(res);
    return (await res.json()) as Promise<BlobDescriptor>;
  }

  // static list blobs
  static async getListAuth(signer: Signer, message = "List Blobs", expiration = oneHour()) {
    return await signer({
      created_at: now(),
      kind: AUTH_EVENT_KIND,
      content: message,
      tags: [
        ["t", "list"],
        ["expiration", String(expiration)],
      ],
    });
  }
  static async listBlobs(
    server: ServerType,
    pubkey: string,
    opts?: { since?: number; until?: number },
    auth?: SignedEvent,
  ) {
    const url = new URL(`/list/` + pubkey, server);
    if (opts?.since) url.searchParams.append("since", String(opts.since));
    if (opts?.until) url.searchParams.append("until", String(opts.until));
    const res = await fetch(url, {
      headers: auth ? { authorization: BlossomClient.encodeAuthorizationHeader(auth) } : {},
    });
    await HTTPError.handleErrorResponse(res);
    return (await res.json()) as Promise<BlobDescriptor[]>;
  }

  // static delete blob
  static async getDeleteAuth(hash: string, signer: Signer, message = "Delete Blob", expiration = oneHour()) {
    return await signer({
      created_at: now(),
      kind: AUTH_EVENT_KIND,
      content: message,
      tags: [
        ["t", "delete"],
        ["x", hash],
        ["expiration", String(expiration)],
      ],
    });
  }
  static async deleteBlob(server: ServerType, hash: string, auth?: SignedEvent) {
    const res = await fetch(new URL("/" + hash, server), {
      method: "DELETE",
      headers: auth ? { authorization: BlossomClient.encodeAuthorizationHeader(auth) } : {},
    });
    await HTTPError.handleErrorResponse(res);
    return await res.text();
  }

  // get blob
  async getGetAuth(message: string, serverOrHash: string, expiration?: number) {
    if (!this.signer) throw new Error("Missing signer");
    return await BlossomClient.getGetAuth(this.signer, message, serverOrHash, expiration);
  }
  async getBlob(hash: string, auth: SignedEvent | boolean = false) {
    if (typeof auth === "boolean" && auth) auth = await this.getGetAuth("Get Blob", hash);
    return BlossomClient.getBlob(this.server, hash, auth ? auth : undefined);
  }

  // upload blob
  async getUploadAuth(file: UploadType, message?: string, expiration?: number) {
    if (!this.signer) throw new Error("Missing signer");
    return await BlossomClient.getUploadAuth(file, this.signer, message, expiration);
  }
  async uploadBlob(file: UploadType, auth: SignedEvent | boolean = true) {
    if (typeof auth === "boolean" && auth) auth = await this.getUploadAuth(file);
    return BlossomClient.uploadBlob(this.server, file, auth ? auth : undefined);
  }

  // mirror blob
  async getMirrorAuth(sha256: string, message?: string, expiration?: number) {
    if (!this.signer) throw new Error("Missing signer");
    return await BlossomClient.createUploadAuth(sha256, this.signer, message, expiration);
  }
  async mirrorBlob(sha256: string, url: string | URL, auth: SignedEvent | boolean = true) {
    if (typeof auth === "boolean" && auth) auth = await this.getMirrorAuth(sha256);
    return BlossomClient.mirrorBlob(this.server, url, auth ? auth : undefined);
  }

  // has blob
  static async hasBlob(server: ServerType, hash: string) {
    const res = await fetch(new URL(`/` + hash, server), { method: "HEAD" });
    await HTTPError.handleErrorResponse(res);
    return res.ok;
  }
  async hasBlob(hash: string) {
    return BlossomClient.hasBlob(this.server, hash);
  }

  // list blobs
  async getListAuth(message?: string, expiration?: number) {
    if (!this.signer) throw new Error("Missing signer");
    return await BlossomClient.getListAuth(this.signer, message, expiration);
  }
  async listBlobs(pubkey: string, opts?: { since?: number; until?: number }, auth: SignedEvent | boolean = false) {
    if (typeof auth === "boolean" && auth) auth = await this.getListAuth();
    return BlossomClient.listBlobs(this.server, pubkey, opts, auth ? auth : undefined);
  }

  // delete blob
  async getDeleteAuth(hash: string, message?: string, expiration?: number) {
    if (!this.signer) throw new Error("Missing signer");
    return await BlossomClient.getDeleteAuth(hash, this.signer, message, expiration);
  }
  async deleteBlob(hash: string, auth: SignedEvent | boolean = true) {
    if (typeof auth === "boolean" && auth) auth = await this.getDeleteAuth(hash);
    return BlossomClient.deleteBlob(this.server, hash, auth ? auth : undefined);
  }
}
