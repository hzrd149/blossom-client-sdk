import { DeleteOptions } from "./actions/delete.js";
import { DownloadOptions } from "./actions/download.js";
import { ListOptions } from "./actions/list.js";
import { MirrorOptions } from "./actions/mirror.js";
import { UploadOptions } from "./actions/upload.js";
import { ServerType, UploadType } from "./client.js";
import { type PaymentRequest as CashuPaymentRequest } from "@cashu/cashu-ts";

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

/** interface for handling payment requests */
export interface PaymentHandlers<S extends ServerType = ServerType> {
  upload?: UploadOptions<S, UploadType>["onPayment"];
  download?: DownloadOptions<S>["onPayment"];
  list?: ListOptions<S>["onPayment"];
  mirror?: MirrorOptions<S>["onPayment"];
  delete?: DeleteOptions<S>["onPayment"];
}

export type BlobDescriptor = {
  uploaded: number;
  type?: string;
  sha256: string;
  size: number;
  url: string;
};

export type PaymentRequest = CashuPaymentRequest;
