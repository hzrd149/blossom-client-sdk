import { describe, expect, it, vi } from "vitest";
import { getEncodedToken, PaymentRequest, Token } from "@cashu/cashu-ts";

import { finalizeEvent, generateSecretKey } from "nostr-tools";
import { downloadBlob } from "../../src/actions/download.js";
import { createMirrorAuth, encodeAuthorizationHeader } from "../../src/auth.js";
import { EventTemplate, Signer } from "../../src/types.js";
import fetchMock from "../fetch.js";

const key = generateSecretKey();
const signer: Signer = async (t: EventTemplate) => finalizeEvent(t, key);

describe("downloadBlob", async () => {
  const mockServer = "https://example.com";
  const mockSha256 = "74f81fe167d99b4cb41d6d0ccda82278caee9f3e2f25d5e5a3936ff3dcec60d0";
  const mockAuth = await createMirrorAuth(signer, mockSha256);

  it("should send the correct request", async () => {
    fetchMock.mockResponseOnce("mock response data", { status: 200 });

    await downloadBlob(mockServer, mockSha256);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const request = fetchMock.requests()[0];

    expect(request.url).toBe(`https://example.com/${mockSha256}`);
    expect(request.method).toBe("GET");
  });

  it("should include Authorization header if auth is provided", async () => {
    fetchMock.mockResponseOnce("mock response data", { status: 200 });

    await downloadBlob(mockServer, mockSha256, { auth: mockAuth });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const request = fetchMock.requests()[0];

    expect(request.headers.get("Authorization")).toBe(encodeAuthorizationHeader(mockAuth));
  });

  it("should retry with auth when receiving 401 status", async () => {
    // First response is 401
    fetchMock.mockResponses(
      [JSON.stringify({ error: "Unauthorized" }), { status: 401 }],
      ["mock response data", { status: 200 }],
    );

    const onAuth = vi.fn().mockResolvedValue(mockAuth);
    await downloadBlob(mockServer, mockSha256, { onAuth });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(onAuth).toHaveBeenCalledWith(mockServer, mockSha256);

    // Check second request has auth header
    const request = fetchMock.requests()[1];
    expect(request.headers.get("Authorization")).toBe(encodeAuthorizationHeader(mockAuth));
  });

  it("should throw error if 401 received and no onAuth handler provided", async () => {
    fetchMock.mockResponseOnce(JSON.stringify({ error: "Unauthorized" }), { status: 401 });

    await expect(downloadBlob(mockServer, mockSha256)).rejects.toThrow("Missing auth handler");
  });

  it("should retry with payment when receiving 402 status", async () => {
    const paymentRequest = new PaymentRequest([], "download-6846354183", 100, "sat", ["https://mint.example.com"]);
    // First response is 402 with payment headers
    fetchMock.mockResponses(
      [
        JSON.stringify({ error: "Payment Required" }),
        {
          status: 402,
          headers: {
            "X-Cashu": paymentRequest.toEncodedRequest(),
          },
        },
      ],
      ["mock response data", { status: 200 }],
    );

    const mockToken: Token = { mint: "https://mint.example.com", proofs: [] };
    const onPayment = vi.fn().mockResolvedValue(mockToken);

    await downloadBlob(mockServer, mockSha256, { onPayment });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(onPayment).toHaveBeenCalledWith(mockServer, mockSha256, paymentRequest);

    // Check second request has payment header
    const request = fetchMock.requests()[1];
    expect(request.headers.get("X-Cashu")).toBe(getEncodedToken(mockToken));
  });

  it("should throw error if 402 received and no onPayment handler provided", async () => {
    const paymentRequest = new PaymentRequest([], "download-6846354183", 100, "sat", ["https://mint.example.com"]);

    fetchMock.mockResponseOnce(JSON.stringify({ error: "Payment Required" }), {
      status: 402,
      headers: {
        "X-Cashu": paymentRequest.toEncodedRequest(),
      },
    });

    await expect(downloadBlob(mockServer, mockSha256)).rejects.toThrow("Missing payment handler");
  });

  it("should respect the AbortSignal", async () => {
    fetchMock.mockResponseOnce("mock response data");

    const controller = new AbortController();
    const signal = controller.signal;

    const promise = downloadBlob(mockServer, mockSha256, { signal });
    controller.abort();

    expect(fetchMock).toHaveBeenCalledTimes(1);

    await expect(promise).rejects.toThrow();
  });

  it("should respect the timeout option", async () => {
    vi.useFakeTimers();
    fetchMock.mockResponseOnce("mock response data", { status: 200 });

    const promise = downloadBlob(mockServer, mockSha256, { timeout: 5000 });
    vi.advanceTimersByTime(6000);
    await expect(promise).rejects.toThrow();
  });

  it("should return the response object", async () => {
    const mockResponseData = "mock response data";
    fetchMock.mockResponseOnce(mockResponseData, { status: 200 });

    const response = await downloadBlob(mockServer, mockSha256);

    expect(response).toBeDefined();
    expect(await response.text()).toBe(mockResponseData);
  });

  it("should preset authorization if auth=true", async () => {
    fetchMock.mockResponseOnce("mock response", { status: 200 });

    const onAuth = vi.fn().mockResolvedValue(mockAuth);
    await downloadBlob(mockServer, mockSha256, { auth: true, onAuth });

    // Check that both requests have the authorization header
    expect(fetchMock.requests()[0].headers.get("Authorization")).toBe(encodeAuthorizationHeader(mockAuth));
  });

  it("should throw an error if auth=true and no onAuth handler is provided", async () => {
    await expect(downloadBlob(mockServer, mockSha256, { auth: true })).rejects.toThrow("Missing onAuth handler");
  });

  it("should throw an error if authorization is requested but is disabled auth=false", async () => {
    fetchMock.mockResponseOnce(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
    await expect(downloadBlob(mockServer, mockSha256, { auth: false })).rejects.toThrow("Authorization disabled");
  });
});
