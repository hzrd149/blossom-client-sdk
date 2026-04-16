import { PaymentRequest } from "../types.js";

/** Extracts a cashu-ts PaymentRequest from Headers. Loads @cashu/cashu-ts on demand. */
export async function getPaymentRequestFromHeaders(headers: Headers): Promise<PaymentRequest>;
export async function getPaymentRequestFromHeaders(headers: Headers, quite: false): Promise<PaymentRequest>;
export async function getPaymentRequestFromHeaders(
  headers: Headers,
  quite: true,
): Promise<PaymentRequest | undefined>;
export async function getPaymentRequestFromHeaders(headers: Headers, quite = false) {
  const header = headers.get("X-Cashu");
  if (!header) {
    if (!quite) throw new Error("Missing cashu header");
    else return undefined;
  }

  const { decodePaymentRequest } = await import("@cashu/cashu-ts");
  const request = decodePaymentRequest(header) as PaymentRequest;

  // Clear the transport, since NUT-23 is only in-band payments
  request.transport = [];

  return request;
}
