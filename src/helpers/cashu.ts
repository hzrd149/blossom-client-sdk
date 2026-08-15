import { PaymentRequest } from "../types.js";

const decodeBase64 = (value: string) => Uint8Array.from(atob(value), (character) => character.charCodeAt(0));
const encodedRequests = new WeakMap<object, string>();

class PaymentRequestCompatibility implements PaymentRequest {
  constructor(
    public transport: PaymentRequest["transport"],
    public id?: string,
    public amount?: number,
    public unit?: string,
    public mints?: string[],
    public description?: string,
    public singleUse = false,
  ) {}

  toRawRequest(): ReturnType<PaymentRequest["toRawRequest"]> {
    return {
      t: this.transport.map((item) => ({ t: item.type, a: item.target, g: item.tags })),
      ...(this.id ? { i: this.id } : {}),
      ...(this.amount ? { a: this.amount } : {}),
      ...(this.unit ? { u: this.unit } : {}),
      ...(this.mints ? { m: this.mints } : {}),
      ...(this.description ? { d: this.description } : {}),
      ...(this.singleUse ? { s: true } : {}),
    };
  }

  toEncodedRequest() {
    return encodedRequests.get(this)!;
  }

  getTransport(type: string) {
    return this.transport.find((item) => item.type === type);
  }
}

function decodeCbor(data: Uint8Array): unknown {
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);

  const decodeLength = (offset: number, info: number): [number, number] => {
    if (info < 24) return [info, offset];
    if (info === 24) return [view.getUint8(offset), offset + 1];
    if (info === 25) return [view.getUint16(offset), offset + 2];
    if (info === 26) return [view.getUint32(offset), offset + 4];
    throw new Error("Unsupported CBOR length");
  };

  const decode = (offset: number): [unknown, number] => {
    const byte = view.getUint8(offset++);
    const type = byte >> 5;
    const info = byte & 0x1f;
    const [length, next] = decodeLength(offset, info);

    if (type === 0) return [length, next];
    if (type === 2) return [data.slice(next, next + length), next + length];
    if (type === 3) return [new TextDecoder().decode(data.slice(next, next + length)), next + length];
    if (type === 4) {
      const values: unknown[] = [];
      let cursor = next;
      for (let index = 0; index < length; index++) {
        const [value, end] = decode(cursor);
        values.push(value);
        cursor = end;
      }
      return [values, cursor];
    }
    if (type === 5) {
      const value: Record<string, unknown> = {};
      let cursor = next;
      for (let index = 0; index < length; index++) {
        const [key, keyEnd] = decode(cursor);
        const [item, itemEnd] = decode(keyEnd);
        value[String(key)] = item;
        cursor = itemEnd;
      }
      return [value, cursor];
    }
    if (type === 7 && info >= 20 && info <= 23) return [[false, true, null, undefined][info - 20], offset];
    throw new Error("Unsupported CBOR value");
  };

  return decode(0)[0];
}

function encodeCbor(value: unknown): Uint8Array {
  const output: number[] = [];
  const length = (major: number, value: number) => {
    if (value < 24) output.push((major << 5) | value);
    else if (value < 256) output.push((major << 5) | 24, value);
    else if (value < 65536) output.push((major << 5) | 25, value >> 8, value & 0xff);
    else output.push((major << 5) | 26, value >> 24, (value >> 16) & 0xff, (value >> 8) & 0xff, value & 0xff);
  };
  const encode = (item: unknown) => {
    if (typeof item === "number") length(0, item);
    else if (typeof item === "string") {
      const bytes = new TextEncoder().encode(item);
      length(3, bytes.length);
      output.push(...bytes);
    } else if (item instanceof Uint8Array) {
      length(2, item.length);
      output.push(...item);
    } else if (Array.isArray(item)) {
      length(4, item.length);
      item.forEach(encode);
    } else if (item && typeof item === "object") {
      const entries = Object.entries(item);
      length(5, entries.length);
      entries.forEach(([key, entry]) => {
        encode(key);
        encode(entry);
      });
    } else if (typeof item === "boolean") output.push(item ? 0xf5 : 0xf4);
    else throw new Error("Unsupported CBOR value");
  };
  encode(value);
  return Uint8Array.from(output);
}

const hexToBytes = (hex: string) => Uint8Array.from(hex.match(/.{1,2}/g) ?? [], (value) => Number.parseInt(value, 16));

/** Extracts a Cashu PaymentRequest-compatible object from Headers. */
export async function getPaymentRequestFromHeaders(headers: Headers): Promise<PaymentRequest>;
export async function getPaymentRequestFromHeaders(headers: Headers, quite: false): Promise<PaymentRequest>;
export async function getPaymentRequestFromHeaders(headers: Headers, quite: true): Promise<PaymentRequest | undefined>;
export async function getPaymentRequestFromHeaders(
  headers: Headers,
  quite = false,
): Promise<PaymentRequest | undefined> {
  const header = headers.get("X-Cashu");
  if (!header) {
    if (!quite) throw new Error("Missing cashu header");
    else return undefined;
  }

  if (!header.startsWith("creqA")) throw new Error("Unsupported cashu payment request");
  const raw = decodeCbor(decodeBase64(header.slice(5))) as ReturnType<PaymentRequest["toRawRequest"]>;
  const request = new PaymentRequestCompatibility([], raw.i, raw.a, raw.u, raw.m, raw.d, raw.s);
  encodedRequests.set(request, header);
  return request;
}

/** Encodes the legacy Cashu token shape used by the deprecated onPayment callback. */
export function encodePaymentToken(token: unknown): string {
  const value = token as {
    mint: string;
    unit?: string;
    memo?: string;
    proofs: Array<{
      id: string;
      amount: number;
      secret: string;
      C: string;
      dleq?: { e: string; s: string; r?: string };
    }>;
  };
  const nonHex = value.proofs.some((proof) => !/^[0-9a-fA-F]+$/.test(proof.id));
  if (nonHex) {
    const json = JSON.stringify({
      token: [{ mint: value.mint, proofs: value.proofs }],
      unit: value.unit,
      memo: value.memo,
    });
    const bytes = new TextEncoder().encode(json);
    let binary = "";
    for (const byte of bytes) binary += String.fromCharCode(byte);
    return "cashuA" + btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  }

  const groups = new Map<string, typeof value.proofs>();
  for (const proof of value.proofs) groups.set(proof.id, [...(groups.get(proof.id) ?? []), proof]);
  const template = {
    m: value.mint,
    u: value.unit || "sat",
    t: [...groups].map(([id, proofs]) => ({
      i: hexToBytes(id),
      p: proofs.map((proof) => ({
        a: proof.amount,
        s: proof.secret,
        c: hexToBytes(proof.C),
        ...(proof.dleq
          ? { d: { e: hexToBytes(proof.dleq.e), s: hexToBytes(proof.dleq.s), r: hexToBytes(proof.dleq.r ?? "00") } }
          : {}),
      })),
    })),
    ...(value.memo ? { d: value.memo } : {}),
  };
  const bytes = encodeCbor(template);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return "cashuB" + btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
