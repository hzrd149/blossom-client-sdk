import { describe, expect, it, vi } from "vitest";
import { getEncodedToken, PaymentRequest, Token } from "@cashu/cashu-ts";

import { finalizeEvent, generateSecretKey } from "nostr-tools";
import { uploadMedia, MediaEndpointMissingError } from "../../src/actions/media.js";
import { createMirrorAuth, encodeAuthorizationHeader } from "../../src/auth.js";
import { BlobDescriptor, EventTemplate, Signer } from "../../src/types.js";
import fetchMock from "../fetch.js";
import { getBlobSha256 } from "../../src/helpers";

const key = generateSecretKey();
const signer: Signer = async (t: EventTemplate) => finalizeEvent(t, key);

describe("uploadMedia", async () => {
  const mockServer = "https://example.com";
  const mockBlob = new Blob(["test content"], { type: "text/plain" });
  const mockSha256 = await getBlobSha256(mockBlob);
  const mockAuth = await createMirrorAuth(signer, mockSha256);

  const mockResponse: BlobDescriptor = {
    uploaded: Date.now(),
    sha256: mockSha256,
    size: mockBlob.size,
    type: mockBlob.type,
    url: `https://example.com/blobs/${mockSha256}`,
  };

  it("should check if upload is allowed with HEAD request first", async () => {
    fetchMock.mockResponses(
      // HEAD response
      ["", { status: 200 }],
      // PUT response
      [JSON.stringify(mockResponse), { status: 200 }],
    );

    await uploadMedia(mockServer, mockBlob);

    expect(fetchMock).toHaveBeenCalledTimes(2);
    const headRequest = fetchMock.requests()[0];
    const putRequest = fetchMock.requests()[1];

    expect(headRequest.url).toBe("https://example.com/media");
    expect(headRequest.method).toBe("HEAD");
    expect(headRequest.headers.get("x-sha-256")).toBe(mockSha256);
    expect(headRequest.headers.get("x-content-length")).toBe(String(mockBlob.size));
    expect(headRequest.headers.get("x-content-type")).toBe(mockBlob.type);

    expect(putRequest.url).toBe("https://example.com/media");
    expect(putRequest.method).toBe("PUT");
    expect(putRequest.headers.get("x-sha-256")).toBe(mockSha256);
  });

  it("should include Authorization header if auth is provided", async () => {
    fetchMock.mockResponses(
      // HEAD response
      ["", { status: 200 }],
      // PUT response
      [JSON.stringify(mockResponse), { status: 200 }],
    );

    await uploadMedia(mockServer, mockBlob, { auth: mockAuth });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    const headRequest = fetchMock.requests()[0];
    const putRequest = fetchMock.requests()[1];

    expect(headRequest.headers.get("Authorization")).toBe(encodeAuthorizationHeader(mockAuth));
    expect(putRequest.headers.get("Authorization")).toBe(encodeAuthorizationHeader(mockAuth));
  });

  it("should retry with auth when receiving 401 status on HEAD", async () => {
    // First response is 401
    fetchMock.mockResponses(["", { status: 401 }], [JSON.stringify(mockResponse), { status: 200 }]);

    const onAuth = vi.fn().mockResolvedValue(mockAuth);
    await uploadMedia(mockServer, mockBlob, { onAuth });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(onAuth).toHaveBeenCalledWith(mockServer, mockSha256, "media", mockBlob);

    // Check second request has auth header
    const request = fetchMock.requests()[1];
    expect(request.headers.get("Authorization")).toBe(encodeAuthorizationHeader(mockAuth));
  });

  it("should throw error if 401 received and no onAuth handler provided", async () => {
    fetchMock.mockResponseOnce("", { status: 401 });

    await expect(uploadMedia(mockServer, mockBlob)).rejects.toThrow("Missing auth handler");
  });

  it("should retry with payment when receiving 402 status on HEAD", async () => {
    const paymentRequest = new PaymentRequest([], "upload-6846354183", 100, "sat", ["https://mint.example.com"]);
    // First response is 402 with payment headers
    fetchMock.mockResponses(
      [
        "",
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

    await uploadMedia(mockServer, mockBlob, { onPayment });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(onPayment).toHaveBeenCalledWith(mockServer, mockSha256, mockBlob, paymentRequest);

    // Check second request has payment header
    const request = fetchMock.requests()[1];
    expect(request.headers.get("X-Cashu")).toBe(getEncodedToken(mockToken));
  });

  it("should throw error if 402 received and no onPayment handler provided", async () => {
    const paymentRequest = new PaymentRequest([], "upload-6846354183", 100, "sat", ["https://mint.example.com"]);

    fetchMock.mockResponseOnce("", {
      status: 402,
      headers: {
        "X-Cashu": paymentRequest.toEncodedRequest(),
      },
    });

    await expect(uploadMedia(mockServer, mockBlob)).rejects.toThrow("Missing payment handler");
  });

  it("should throw error on server error (5xx)", async () => {
    fetchMock.mockResponseOnce("", { status: 500 });

    await expect(uploadMedia(mockServer, mockBlob)).rejects.toThrow("Server error");
  });

  it("should throw MediaEndpointMissingError if HEAD endpoint returns 404", async () => {
    fetchMock.mockResponseOnce("", { status: 404 });

    await expect(uploadMedia(mockServer, mockBlob)).rejects.toThrow(MediaEndpointMissingError);
  });

  it("should not include X-Content-Type if blob type is not set", async () => {
    fetchMock.mockResponses(["", { status: 200 }], [JSON.stringify(mockResponse), { status: 200 }]);

    const blobWithoutType = new Blob(["test content"]);
    await uploadMedia(mockServer, blobWithoutType);

    expect(fetchMock).toHaveBeenCalledTimes(2);
    const request = fetchMock.requests()[0];

    expect(request.headers.has("x-content-type")).toBeFalsy();
  });

  it("should respect the AbortSignal", async () => {
    fetchMock.mockResponseOnce("", { status: 200 });

    const controller = new AbortController();
    const signal = controller.signal;

    const promise = uploadMedia(mockServer, mockBlob, { signal });
    controller.abort();

    await expect(promise).rejects.toThrow();
  });

  it("should accept the timeout option", async () => {
    fetchMock.mockResponseOnce(() => {
      return new Promise((resolve) => {
        setTimeout(() => resolve({ body: "", status: 200 }), 100);
      });
    });

    await expect(uploadMedia(mockServer, mockBlob, { timeout: 50 })).rejects.toThrow();
  });

  it("should always attach authorization  if auth=true", async () => {
    fetchMock.mockResponses(
      // HEAD response
      ["", { status: 200 }],
      // PUT response
      [JSON.stringify(mockResponse), { status: 200 }],
    );

    const onAuth = vi.fn().mockResolvedValue(mockAuth);
    await uploadMedia(mockServer, mockBlob, { auth: true, onAuth });

    expect(fetchMock.requests()[0].headers.get("Authorization")).toBe(encodeAuthorizationHeader(mockAuth));
    expect(fetchMock.requests()[1].headers.get("Authorization")).toBe(encodeAuthorizationHeader(mockAuth));
  });

  it("should throw an error if auth=true and no onAuth handler is provided", async () => {
    await expect(uploadMedia(mockServer, mockBlob, { auth: true })).rejects.toThrow("Missing onAuth handler");
  });

  it("should throw an error if auth=false and authorization is requested", async () => {
    fetchMock.mockResponseOnce(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
    await expect(uploadMedia(mockServer, mockBlob, { auth: false })).rejects.toThrow("Authorization disabled");
  });
});
