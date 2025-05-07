import { decodePaymentRequest } from "@cashu/cashu-ts";
import { PaymentRequest } from "../types.js";

/** Extracts a cashu-ts PaymentRequest from Headers */
export function getPaymentRequestFromHeaders(headers: Headers): PaymentRequest;
export function getPaymentRequestFromHeaders(headers: Headers, quite: false): PaymentRequest;
export function getPaymentRequestFromHeaders(headers: Headers, quite: true): PaymentRequest | undefined;
export function getPaymentRequestFromHeaders(headers: Headers, quite = false) {
  const header = headers.get("X-Cashu");
  if (!header) {
    if (!quite) throw new Error("Missing cashu header");
    else return undefined;
  }

  const request = decodePaymentRequest(header);

  // Clear the transport, since NUT-23 is only in-band payments
  request.transport = [];

  return request;
}
