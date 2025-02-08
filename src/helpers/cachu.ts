import { PaymentRequest } from "../types.js";

/** Extracts a cashu-ts PaymentRequest from Headers */
export function getPaymentRequestFromHeaders(headers: Headers): PaymentRequest;
export function getPaymentRequestFromHeaders(headers: Headers, quite: false): PaymentRequest;
export function getPaymentRequestFromHeaders(headers: Headers, quite: true): PaymentRequest | undefined;
export function getPaymentRequestFromHeaders(headers: Headers, quite = false) {
  const header = headers.get("X-Cashu");
  if (!header && !quite) throw new Error("Missing cashu header");
  return header ? (JSON.parse(atob(header)) as PaymentRequest) : undefined;
}
