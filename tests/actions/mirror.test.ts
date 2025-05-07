import { describe, expect, it, vi } from "vitest";
import { getEncodedToken, PaymentRequest, Token } from "@cashu/cashu-ts";

import { finalizeEvent, generateSecretKey } from "nostr-tools";
import { mirrorBlob } from "../../src/actions/mirror.js";
import { createMirrorAuth, encodeAuthorizationHeader } from "../../src/auth.js";
import { BlobDescriptor, EventTemplate, Signer } from "../../src/types.js";
import fetchMock from "../fetch.js";

const key = generateSecretKey();
const signer: Signer = async (t: EventTemplate) => finalizeEvent(t, key);

describe("mirrorBlob", async () => {
  const mockServer = "https://example.com";
  const mockBlob: BlobDescriptor = {
    uploaded: 0,
    sha256: "74f81fe167d99b4cb41d6d0ccda82278caee9f3e2f25d5e5a3936ff3dcec60d0",
    size: 1024,
    type: "image/jpeg",
    url: "https://source.example.com/image.jpg",
  };

  const mockResponse: BlobDescriptor = {
    uploaded: 0,
    sha256: mockBlob.sha256,
    size: mockBlob.size,
    type: mockBlob.type,
    url: "https://example.com/blobs/74f81fe167d99b4cb41d6d0ccda82278caee9f3e2f25d5e5a3936ff3dcec60d0",
  };

  const mockAuth = await createMirrorAuth(signer, mockBlob.sha256);

  it("should send the correct headers in the request", async () => {
    fetchMock.mockResponseOnce(JSON.stringify(mockResponse));

    await mirrorBlob(mockServer, mockBlob);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const request = fetchMock.requests()[0];

    expect(request.url).toBe("https://example.com/mirror");
    expect(request.headers.get("x-sha-256")).toBe(mockBlob.sha256);
    expect(request.headers.get("x-content-length")).toBe(String(mockBlob.size));
    expect(request.headers.get("x-content-type")).toBe(mockBlob.type);
    expect(request.headers.get("content-type")).toBe("application/json");
    expect(request.method).toBe("PUT");
    expect(request.text()).resolves.toEqual(JSON.stringify({ url: mockBlob.url }));
  });

  it("should not include X-Content-Type if blob type is not set", async () => {
    fetchMock.mockResponseOnce(JSON.stringify(mockResponse));

    const blobWithoutType = { ...mockBlob, type: undefined };
    await mirrorBlob(mockServer, blobWithoutType);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const request = fetchMock.requests()[0];

    expect(request.headers.has("x-content-type")).toBeFalsy();
  });

  it("should include Authorization header if auth is provided", async () => {
    fetchMock.mockResponseOnce(JSON.stringify(mockResponse));

    await mirrorBlob(mockServer, mockBlob, { auth: mockAuth });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const request = fetchMock.requests()[0];

    expect(request.headers.get("Authorization")).toBe(encodeAuthorizationHeader(mockAuth));
  });

  it("should retry with auth when receiving 401 status", async () => {
    // First response is 401
    fetchMock.mockResponses(
      [JSON.stringify({ error: "Unauthorized" }), { status: 401 }],
      [JSON.stringify(mockResponse), { status: 200 }],
    );

    const onAuth = vi.fn().mockResolvedValue(mockAuth);
    await mirrorBlob(mockServer, mockBlob, { onAuth });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(onAuth).toHaveBeenCalledWith(mockServer, mockBlob.sha256, mockBlob);

    // Check second request has auth header
    const request = fetchMock.requests()[1];
    expect(request.headers.get("Authorization")).toBe(encodeAuthorizationHeader(mockAuth));
  });

  it("should throw error if 401 received and no onAuth handler provided", async () => {
    fetchMock.mockResponseOnce(JSON.stringify({ error: "Unauthorized" }), { status: 401 });

    await expect(mirrorBlob(mockServer, mockBlob)).rejects.toThrow("Missing auth handler");
  });

  it("should retry with payment when receiving 402 status", async () => {
    const paymentRequest = new PaymentRequest([], "upload-6846354183", 100, "sat", ["https://mint.example.com"]);
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
      [JSON.stringify(mockResponse), { status: 200 }],
    );

    const mockToken: Token = { mint: "https://mint.example.com", proofs: [] };
    const onPayment = vi.fn().mockResolvedValue(mockToken);

    await mirrorBlob(mockServer, mockBlob, { onPayment });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(onPayment).toHaveBeenCalledWith(mockServer, mockBlob.sha256, mockBlob, paymentRequest);

    // Check second request has payment header
    const request = fetchMock.requests()[1];
    expect(request.headers.get("X-Cashu")).toBe(getEncodedToken(mockToken));
  });

  it("should throw error if 402 received and no onPayment handler provided", async () => {
    const paymentRequest = new PaymentRequest([], "upload-6846354183", 100, "sat", ["https://mint.example.com"]);

    fetchMock.mockResponseOnce(JSON.stringify({ error: "Payment Required" }), {
      status: 402,
      headers: {
        "X-Cashu": paymentRequest.toEncodedRequest(),
      },
    });

    await expect(mirrorBlob(mockServer, mockBlob)).rejects.toThrow("Missing payment handler");
  });

  it("should respect the AbortSignal", async () => {
    fetchMock.mockResponseOnce(JSON.stringify(mockResponse));

    const controller = new AbortController();
    const signal = controller.signal;

    const promise = mirrorBlob(mockServer, mockBlob, { signal });
    controller.abort();

    expect(fetchMock).toHaveBeenCalledTimes(1);

    await expect(promise).rejects.toThrow();
  });
});
