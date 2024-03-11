import fetch from "cross-fetch";
const now = () => Math.floor(new Date().valueOf() / 1000);
const oneHour = () => now() + 60 * 60;

export type EventTemplate = {
  created_at: number;
  kind: number;
  content: string;
  tags: string[][];
};
export type SignedEvent = EventTemplate & { id: string; sig: string, pubkey: string };

export type Signer = (draft: EventTemplate) => Promise<SignedEvent>;

export type BlobDescriptor = {
  created: number;
  type?: string;
  sha256: string;
  size: number;
  url: string;
};

export class BlossomClient {
  server: string;
  signer?: Signer;

  constructor(server: string, signer?: Signer) {
    this.server = new URL("/", server).toString();
    this.signer = signer;
  }

  static async getGetAuth(
    signer: Signer,
    message = "Get Blobs",
    expiration = oneHour(),
  ) {
    return await signer({
      created_at: now(),
      kind: 24242,
      content: message,
      tags: [
        ["t", "get"],
        ["expiration", String(expiration)],
      ],
    });
  }
  static async getUploadAuth(
    file: File,
    signer: Signer,
    message = "Upload Blob",
    expiration = oneHour(),
  ) {
    return await signer({
      created_at: now(),
      kind: 24242,
      content: message,
      tags: [
        ["t", "upload"],
        ["name", file.name],
        ["size", String(file.size)],
        ["expiration", String(expiration)],
      ],
    });
  }
  static async getDeleteAuth(
    hash: string,
    signer: Signer,
    message = "Delete Blob",
    expiration = oneHour(),
  ) {
    return await signer({
      created_at: now(),
      kind: 24242,
      content: message,
      tags: [
        ["t", "delete"],
        ["x", hash],
        ["expiration", String(expiration)],
      ],
    });
  }
  static async getListAuth(
    signer: Signer,
    message = "List Blobs",
    expiration = oneHour(),
  ) {
    return await signer({
      created_at: now(),
      kind: 24242,
      content: message,
      tags: [
        ["t", "list"],
        ["expiration", String(expiration)],
      ],
    });
  }

  async getGetAuth(message?: string, expiration?: number) {
    if (!this.signer) throw new Error("Missing signer");
    return await BlossomClient.getGetAuth(this.signer, message, expiration);
  }
  async getUploadAuth(file: File, message?: string, expiration?: number) {
    if (!this.signer) throw new Error("Missing signer");
    return await BlossomClient.getUploadAuth(
      file,
      this.signer,
      message,
      expiration,
    );
  }
  async getDeleteAuth(hash: string, message?: string, expiration?: number) {
    if (!this.signer) throw new Error("Missing signer");
    return await BlossomClient.getDeleteAuth(
      hash,
      this.signer,
      message,
      expiration,
    );
  }
  async getListAuth(message?: string, expiration?: number) {
    if (!this.signer) throw new Error("Missing signer");
    return await BlossomClient.getListAuth(this.signer, message, expiration);
  }

  static encodeAuthorizationHeader(event: SignedEvent) {
    return "Nostr " + btoa(JSON.stringify(event));
  }

  static async getBlob(server: string, hash: string, auth?: SignedEvent) {
    const res = await fetch(new URL(hash, server), {
      headers: auth
        ? { authorization: BlossomClient.encodeAuthorizationHeader(auth) }
        : {},
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.message);
    }
    return await res.blob();
  }
  async getBlob(hash: string, auth: SignedEvent | boolean = false) {
    if (typeof auth === "boolean" && auth) auth = await this.getGetAuth();
    return BlossomClient.getBlob(this.server, hash, auth ? auth : undefined);
  }

  static async listBlobs(
    server: string,
    pubkey: string,
    opts?: { since?: number; until?: number },
    auth?: SignedEvent,
  ) {
    const url = new URL(`/list/` + pubkey, server);
    if (opts?.since) url.searchParams.append("since", String(opts.since));
    if (opts?.until) url.searchParams.append("until", String(opts.until));
    const res = await fetch(url, {
      headers: auth
        ? { authorization: BlossomClient.encodeAuthorizationHeader(auth) }
        : {},
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.message);
    }
    return (await res.json()) as Promise<BlobDescriptor[]>;
  }
  async listBlobs(
    pubkey: string,
    opts?: { since?: number; until?: number },
    auth: SignedEvent | boolean = false,
  ) {
    if (typeof auth === "boolean" && auth) auth = await this.getListAuth();
    return BlossomClient.listBlobs(
      this.server,
      pubkey,
      opts,
      auth ? auth : undefined,
    );
  }

  static async deleteBlob(server: string, hash: string, auth?: SignedEvent) {
    const res = await fetch(new URL("/" + hash, server), {
      method: "DELETE",
      headers: auth
        ? { authorization: BlossomClient.encodeAuthorizationHeader(auth) }
        : {},
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.message);
    }
    return await res.text();
  }
  async deleteBlob(hash: string, auth: SignedEvent | boolean = true) {
    if (typeof auth === "boolean" && auth)
      auth = await this.getDeleteAuth(hash);
    return BlossomClient.deleteBlob(this.server, hash, auth ? auth : undefined);
  }

  static async uploadBlob(server: string, file: File, auth?: SignedEvent) {
    const res = await fetch(new URL("/upload", server), {
      method: "PUT",
      body: file,
      headers: auth
        ? { authorization: BlossomClient.encodeAuthorizationHeader(auth) }
        : {},
    });

    if (!res.ok) throw new Error(await res.text());
    return (await res.json()) as Promise<BlobDescriptor>;
  }
  async uploadBlob(file: File, auth: SignedEvent | boolean = true) {
    if (typeof auth === "boolean" && auth)
      auth = await this.getUploadAuth(file);
    return BlossomClient.uploadBlob(this.server, file, auth ? auth : undefined);
  }
}
