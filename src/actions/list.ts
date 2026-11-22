import HTTPError from "../error.js";
import { ServerType } from "../types.js";
import { BlobDescriptor, PaymentRequest, PaymentToken, SignedEvent } from "../types.js";
import { encodeAuthorizationHeader, getReusableAuthEvent, storeAuthEvent } from "../auth.js";
import { fetchWithTimeout } from "../helpers/index.js";
import { handleChallenges } from "../internal/challenges.js";

export type ListOptions<S extends ServerType> = {
  /** AbortSignal to cancel the action */
  signal?: AbortSignal;
  /** Override authorization event, or true to always use authorization, false to disable authorization */
  auth?: SignedEvent | boolean;
  /** Shared auth event store used to reuse non-expired auth events between requests */
  authEvents?: Set<SignedEvent>;
  /** Request timeout */
  timeout?: number;
  cursor?: string;
  limit?: number;
  since?: number;
  until?: number;
  /** Return headers to retry a request rejected with HTTP 402. */
  onPaymentRequired?: (server: S, headers: Headers) => Promise<HeadersInit>;
  /**
   * A method used to request payment
   * @param server the server requiring payment
   * @param request the payment request
   */
  /** @deprecated Use onPaymentRequired to handle payment schemes generically. */
  onPayment?: (server: S, request: PaymentRequest) => Promise<PaymentToken>;
  /**
   * A method used to request a signed auth event for a server
   * @param server the server requesting the auth
   */
  onAuth?: (server: S) => Promise<SignedEvent>;
};

/** Lists a page of blobs from a server */
export async function listBlobs<S extends ServerType>(
  server: S,
  pubkey: string,
  opts?: ListOptions<S>,
): Promise<BlobDescriptor[]> {
  const url = new URL(`/list/` + pubkey, server);
  if (opts?.cursor) url.searchParams.append("cursor", opts.cursor);
  if (opts?.limit) url.searchParams.append("limit", String(opts.limit));
  if (opts?.since) url.searchParams.append("since", String(opts.since));
  if (opts?.until) url.searchParams.append("until", String(opts.until));
  const resolveAuth = async (preset: boolean = false) => {
    const reused = opts?.authEvents ? await getReusableAuthEvent(opts.authEvents, { server, type: "list" }) : undefined;
    if (reused) return reused;

    const auth = await opts?.onAuth?.(server);
    if (!auth) throw new Error(preset ? "Missing onAuth handler" : "Missing auth handler");

    if (opts?.authEvents) storeAuthEvent(opts.authEvents, auth);
    return auth;
  };

  // attach the auth if its already set
  const headers: HeadersInit = {};

  // attach the authorization if its already set
  if (opts?.auth) {
    if (typeof opts.auth === "boolean") {
      headers["Authorization"] = encodeAuthorizationHeader(await resolveAuth(true));
    } else {
      headers["Authorization"] = encodeAuthorizationHeader(opts.auth);
    }
  }

  const request = (headers: HeadersInit) =>
    fetchWithTimeout(url, { headers, signal: opts?.signal, timeout: opts?.timeout });
  const list = await handleChallenges(await request(headers), headers, request, {
    signal: opts?.signal,
    auth: async () => {
      if (opts?.auth === false) throw new Error("Authorization disabled");
      return { Authorization: encodeAuthorizationHeader(await resolveAuth()) };
    },
    payment: async (headers) => {
      if (opts?.onPaymentRequired) return opts.onPaymentRequired(server, headers);
      if (opts?.onPayment) {
        const { encodePaymentToken, getPaymentRequestFromHeaders } = await import("../helpers/cashu.js");
        const request = await getPaymentRequestFromHeaders(headers);
        return { "X-Cashu": encodePaymentToken(await opts.onPayment(server, request)) };
      }
      throw new Error("Missing payment handler");
    },
  });

  // handle errors
  await HTTPError.handleErrorResponse(list);

  // return blob descriptor
  return list.json();
}

/** Iterates through blob pages using cursor-based pagination */
export async function* iterateBlobs<S extends ServerType>(
  server: S,
  pubkey: string,
  opts?: ListOptions<S>,
): AsyncGenerator<BlobDescriptor[], void, void> {
  let cursor = opts?.cursor;

  while (true) {
    const page = await listBlobs(server, pubkey, { ...opts, cursor });
    if (page.length === 0) return;

    yield page;

    if (opts?.limit && page.length < opts.limit) return;
    cursor = page[page.length - 1]?.sha256;

    if (!cursor) return;
  }
}
