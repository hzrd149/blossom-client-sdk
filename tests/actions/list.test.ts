import { describe, expect, it, vi } from "vitest";
import { getEncodedToken, PaymentRequest, Token } from "@cashu/cashu-ts";

import { finalizeEvent, generateSecretKey } from "nostr-tools";
import { iterateBlobs, listBlobs } from "../../src/actions/list.js";
import { createListAuth, encodeAuthorizationHeader } from "../../src/auth.js";
import { BlobDescriptor, EventTemplate, Signer } from "../../src/types.js";
import fetchMock from "../fetch.js";

const key = generateSecretKey();
const signer: Signer = async (t: EventTemplate) => finalizeEvent(t, key);

describe("listBlobs", async () => {
  const mockServer = "https://example.com";
  const mockPubkey = "npub1abcdefghijklmnopqrstuvwxyz0123456789abcdefghijklmnopqr";
  const mockAuth = await createListAuth(signer);

  const mockBlobs: BlobDescriptor[] = [
    {
      uploaded: 1000000000,
      sha256: "74f81fe167d99b4cb41d6d0ccda82278caee9f3e2f25d5e5a3936ff3dcec60d0",
      size: 1024,
      type: "image/jpeg",
      url: "https://example.com/blobs/74f81fe167d99b4cb41d6d0ccda82278caee9f3e2f25d5e5a3936ff3dcec60d0",
    },
    {
      uploaded: 1000000001,
      sha256: "84f81fe167d99b4cb41d6d0ccda82278caee9f3e2f25d5e5a3936ff3dcec60d1",
      size: 2048,
      type: "image/png",
      url: "https://example.com/blobs/84f81fe167d99b4cb41d6d0ccda82278caee9f3e2f25d5e5a3936ff3dcec60d1",
    },
  ];

  it("should send the correct request", async () => {
    fetchMock.mockResponseOnce(JSON.stringify(mockBlobs));

    await listBlobs(mockServer, mockPubkey);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const request = fetchMock.requests()[0];

    expect(request.url).toBe(`https://example.com/list/${mockPubkey}`);
    expect(request.method).toBe("GET");
  });

  it("should include since and until parameters when provided", async () => {
    fetchMock.mockResponseOnce(JSON.stringify(mockBlobs));

    const since = 1000000000;
    const until = 1000000100;
    await listBlobs(mockServer, mockPubkey, { since, until });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const request = fetchMock.requests()[0];

    expect(request.url).toBe(`https://example.com/list/${mockPubkey}?since=1000000000&until=1000000100`);
  });

  it("should include cursor and limit parameters when provided", async () => {
    fetchMock.mockResponseOnce(JSON.stringify(mockBlobs));

    await listBlobs(mockServer, mockPubkey, { cursor: mockBlobs[1].sha256, limit: 10 });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const request = fetchMock.requests()[0];

    expect(request.url).toBe(`https://example.com/list/${mockPubkey}?cursor=${mockBlobs[1].sha256}&limit=10`);
  });

  it("should include Authorization header if auth is provided", async () => {
    fetchMock.mockResponseOnce(JSON.stringify(mockBlobs));

    await listBlobs(mockServer, mockPubkey, { auth: mockAuth });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const request = fetchMock.requests()[0];

    expect(request.headers.get("Authorization")).toBe(encodeAuthorizationHeader(mockAuth));
  });

  it("should retry with auth when receiving 401 status", async () => {
    // First response is 401
    fetchMock.mockResponses(
      [JSON.stringify({ error: "Unauthorized" }), { status: 401 }],
      [JSON.stringify(mockBlobs), { status: 200 }],
    );

    const onAuth = vi.fn().mockResolvedValue(mockAuth);
    await listBlobs(mockServer, mockPubkey, { onAuth });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(onAuth).toHaveBeenCalledWith(mockServer);

    // Check second request has auth header
    const request = fetchMock.requests()[1];
    expect(request.headers.get("Authorization")).toBe(encodeAuthorizationHeader(mockAuth));
  });

  it("should throw error if 401 received and no onAuth handler provided", async () => {
    fetchMock.mockResponseOnce(JSON.stringify({ error: "Unauthorized" }), { status: 401 });

    await expect(listBlobs(mockServer, mockPubkey)).rejects.toThrow("Missing auth handler");
  });

  it("should retry with payment when receiving 402 status", async () => {
    const paymentRequest = new PaymentRequest([], "list-6846354183", 100, "sat", ["https://mint.example.com"]);
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
      [JSON.stringify(mockBlobs), { status: 200 }],
    );

    const mockToken: Token = { mint: "https://mint.example.com", proofs: [] };
    const onPayment = vi.fn().mockResolvedValue(mockToken);

    await listBlobs(mockServer, mockPubkey, { onPayment });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(onPayment).toHaveBeenCalledWith(mockServer, paymentRequest);

    // Check second request has payment header
    const request = fetchMock.requests()[1];
    expect(request.headers.get("X-Cashu")).toBe(getEncodedToken(mockToken));
  });

  it("should retry with generic payment headers", async () => {
    fetchMock.mockResponses(
      ["Payment Required", { status: 402, headers: { "Payment-Required": "scheme=test" } }],
      [JSON.stringify(mockBlobs), { status: 200 }],
    );
    const onPaymentRequired = vi.fn().mockResolvedValue({ Authorization: "Payment test-token" });

    await listBlobs(mockServer, mockPubkey, { onPaymentRequired });

    expect(onPaymentRequired).toHaveBeenCalledWith(mockServer, expect.any(Headers));
    expect(fetchMock.requests()[1]?.headers.get("Authorization")).toBe("Payment test-token");
  });

  it("should throw error if 402 received and no onPayment handler provided", async () => {
    const paymentRequest = new PaymentRequest([], "list-6846354183", 100, "sat", ["https://mint.example.com"]);

    fetchMock.mockResponseOnce(JSON.stringify({ error: "Payment Required" }), {
      status: 402,
      headers: {
        "X-Cashu": paymentRequest.toEncodedRequest(),
      },
    });

    await expect(listBlobs(mockServer, mockPubkey)).rejects.toThrow("Missing payment handler");
  });

  it("should respect the AbortSignal", async () => {
    fetchMock.mockResponseOnce(JSON.stringify(mockBlobs));

    const controller = new AbortController();
    const signal = controller.signal;

    const promise = listBlobs(mockServer, mockPubkey, { signal });
    controller.abort();

    expect(fetchMock).toHaveBeenCalledTimes(1);

    await expect(promise).rejects.toThrow();
  });

  it("should return the list of blobs", async () => {
    fetchMock.mockResponseOnce(JSON.stringify(mockBlobs));

    const result = await listBlobs(mockServer, mockPubkey);

    expect(result).toEqual(mockBlobs);
  });

  it("should preset authorization if auth=true", async () => {
    fetchMock.mockResponseOnce(JSON.stringify(mockBlobs));

    const onAuth = vi.fn().mockResolvedValue(mockAuth);
    await listBlobs(mockServer, mockPubkey, { auth: true, onAuth });

    // Check that both requests have the authorization header
    expect(fetchMock.requests()[0].headers.get("Authorization")).toBe(encodeAuthorizationHeader(mockAuth));
  });

  it("should throw an error if auth=true and no onAuth handler is provided", async () => {
    await expect(listBlobs(mockServer, mockPubkey, { auth: true })).rejects.toThrow("Missing onAuth handler");
  });

  it("should reuse scoped list auth from authEvents", async () => {
    fetchMock.mockResponseOnce(JSON.stringify(mockBlobs));

    const authEvents = new Set([await createListAuth(signer, { servers: mockServer })]);
    const onAuth = vi.fn();
    await listBlobs(mockServer, mockPubkey, { auth: true, authEvents, onAuth });

    expect(onAuth).not.toHaveBeenCalled();
    expect(fetchMock.requests()[0].headers.get("Authorization")).toBeTruthy();
  });

  it("should throw an error if authorization is requested but is disabled auth=false", async () => {
    fetchMock.mockResponseOnce(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
    await expect(listBlobs(mockServer, mockPubkey, { auth: false })).rejects.toThrow("Authorization disabled");
  });

  it("should iterate pages with cursor pagination", async () => {
    const pageOne = mockBlobs;
    const pageTwo: BlobDescriptor[] = [
      {
        uploaded: 1000000002,
        sha256: "94f81fe167d99b4cb41d6d0ccda82278caee9f3e2f25d5e5a3936ff3dcec60d2",
        size: 4096,
        type: "image/webp",
        url: "https://example.com/blobs/94f81fe167d99b4cb41d6d0ccda82278caee9f3e2f25d5e5a3936ff3dcec60d2",
      },
      {
        uploaded: 1000000003,
        sha256: "a4f81fe167d99b4cb41d6d0ccda82278caee9f3e2f25d5e5a3936ff3dcec60d3",
        size: 8192,
        type: "image/gif",
        url: "https://example.com/blobs/a4f81fe167d99b4cb41d6d0ccda82278caee9f3e2f25d5e5a3936ff3dcec60d3",
      },
    ];

    fetchMock.mockResponses(
      [JSON.stringify(pageOne), { status: 200 }],
      [JSON.stringify(pageTwo), { status: 200 }],
      [JSON.stringify([]), { status: 200 }],
    );

    const pages: BlobDescriptor[][] = [];
    for await (const page of iterateBlobs(mockServer, mockPubkey, { limit: 2 })) pages.push(page);

    expect(pages).toEqual([pageOne, pageTwo]);
    expect(fetchMock.requests().map((request) => request.url)).toEqual([
      `https://example.com/list/${mockPubkey}?limit=2`,
      `https://example.com/list/${mockPubkey}?cursor=${pageOne[pageOne.length - 1].sha256}&limit=2`,
      `https://example.com/list/${mockPubkey}?cursor=${pageTwo[pageTwo.length - 1].sha256}&limit=2`,
    ]);
  });

  it("should stop iterating when a page is shorter than the requested limit", async () => {
    const pageOne = [mockBlobs[0]];
    fetchMock.mockResponseOnce(JSON.stringify(pageOne));

    const pages: BlobDescriptor[][] = [];
    for await (const page of iterateBlobs(mockServer, mockPubkey, { limit: 2 })) pages.push(page);

    expect(pages).toEqual([pageOne]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
