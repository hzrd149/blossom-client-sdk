import { describe, expect, it } from "vitest";
import { getPaymentRequestFromHeaders } from "../../src/helpers/cachu.js";
import { PaymentRequest } from "../../src/types.js";

describe("getPaymentRequestFromHeaders", () => {
  const mockPaymentRequest: PaymentRequest = {
    amount: 100,
    mints: ["https://cashu.space"],
    unit: "sat",
  };

  const encodedHeader = btoa(JSON.stringify(mockPaymentRequest));

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
});
