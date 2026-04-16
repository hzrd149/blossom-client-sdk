import { DeleteOptions } from "./actions/delete.js";
import { DownloadOptions } from "./actions/download.js";
import { ListOptions } from "./actions/list.js";
import { MirrorOptions } from "./actions/mirror.js";
import { UploadOptions } from "./actions/upload.js";
export type ServerType = string | URL;
export type UploadType = Blob | File | Buffer;

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

export type RejectionAction = "skip" | "cancel";

// NOTE: structural copies of cashu-ts types so @cashu/cashu-ts can stay an
// optional peer dependency. Keep field shapes in sync with cashu-ts upstream.

export type PaymentRequestTransport = {
  type: string;
  target: string;
  tags?: Array<Array<string>>;
};

export type RawTransport = {
  t: string;
  a: string;
  g?: Array<Array<string>>;
};

export type RawPaymentRequest = {
  i?: string;
  a?: number;
  u?: string;
  s?: boolean;
  m?: Array<string>;
  d?: string;
  t: Array<RawTransport>;
};

/** Copy of the PaymentRequest class shape from cashu-ts */
export type PaymentRequest = {
  transport: Array<PaymentRequestTransport>;
  id?: string;
  amount?: number;
  unit?: string;
  mints?: Array<string>;
  description?: string;
  singleUse: boolean;
  toRawRequest(): RawPaymentRequest;
  toEncodedRequest(): string;
  getTransport(type: string): PaymentRequestTransport | undefined;
};

type SerializedDLEQ = {
  s: string;
  e: string;
  r?: string;
};
type Proof = {
  id: string;
  amount: number;
  secret: string;
  C: string;
  dleq?: SerializedDLEQ;
};

/** Copy of the Token type from cashu-ts */
export type PaymentToken = {
  mint: string;
  proofs: Array<Proof>;
  memo?: string;
  unit?: string;
};
