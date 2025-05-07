import { describe, expect, it } from "vitest";
import { getPaymentRequestFromHeaders } from "../../src/helpers/cachu.js";
import { PaymentRequest, PaymentRequestTransportType } from "@cashu/cashu-ts";

describe("getPaymentRequestFromHeaders", () => {
  const mockPaymentRequest = new PaymentRequest([], undefined, 100, "sat", ["https://cashu.space"]);
  const encodedHeader = mockPaymentRequest.toEncodedRequest();

  it("should get a payment request from headers", () => {
    const headers = new Headers();
    headers.set("X-Cashu", encodedHeader);

    const result = getPaymentRequestFromHeaders(headers);

    expect(result).toEqual(mockPaymentRequest);
  });

  it("should throw an error when header is missing and quiet is false", () => {
    const headers = new Headers();

    expect(() => getPaymentRequestFromHeaders(headers)).toThrow("Missing cashu header");
    expect(() => getPaymentRequestFromHeaders(headers, false)).toThrow("Missing cashu header");
  });

  it("should return undefined when header is missing and quiet is true", () => {
    const headers = new Headers();

    const result = getPaymentRequestFromHeaders(headers, true);

    expect(result).toBeUndefined();
  });

  it("should always return a payment request with empty transport array", () => {
    const headers = new Headers();
    // Create a payment request with non-empty transport
    const mockPaymentRequest = new PaymentRequest(
      [{ type: PaymentRequestTransportType.POST, target: "https://cashu.space" }],
      undefined,
      100,
      "sat",
      ["https://cashu.space"],
    );
    const encodedHeader = mockPaymentRequest.toEncodedRequest();
    headers.set("X-Cashu", encodedHeader);

    const result = getPaymentRequestFromHeaders(headers);

    expect(result.transport).toEqual([]);
  });
});
