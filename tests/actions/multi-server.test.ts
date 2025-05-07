import { beforeEach, describe, expect, it, vi } from "vitest";

import { finalizeEvent, generateSecretKey } from "nostr-tools";
import { multiServerUpload } from "../../src/actions/multi-server.js";
import { createUploadAuth } from "../../src/auth";
import { EventTemplate, PaymentToken, Signer } from "../../src/types.js";
import fetchMock from "../fetch.js";
import {
	expectNoErrors,
	MockBrokenServer,
	MockOfflineServer,
	MockServer,
	MockServerNoMedia,
	MockServerRequireAuth,
	MockServerRequirePayment,
	MockUnauthorizedServer,
	modifiedHash,
	uploadBlob,
	uploadHash,
} from "../mock-servers";

const key = generateSecretKey();
const signer: Signer = async (t: EventTemplate) => finalizeEvent(t, key);

describe("multiServerUpload", async () => {
  let mockServers: MockServer[] = [];

  beforeEach(() => {
    fetchMock.mockResponse((req) => {
      for (const server of mockServers) {
        if (req.url.startsWith(server.url)) return server.handleRequest(req);
      }
    });
  });

  it("should upload to first server then mirror to other servers", async () => {
    mockServers = [
      new MockServer("https://server1.com"),
      new MockServer("https://server2.com"),
      new MockServer("https://server3.com"),
    ];

    await multiServerUpload(
      mockServers.map((s) => s.url),
      uploadBlob,
      { onError: expectNoErrors },
    );

    // Upload to first server
    expect(mockServers[0].endpoints).toEqual([
      expect.objectContaining({ pathname: "/upload", method: "HEAD" }),
      expect.objectContaining({ pathname: "/upload", method: "PUT" }),
    ]);

    // Mirror to second server
    expect(mockServers[1].endpoints).toEqual([expect.objectContaining({ pathname: "/mirror", method: "PUT" })]);

    // Mirror to third server
    expect(mockServers[2].endpoints).toEqual([expect.objectContaining({ pathname: "/mirror", method: "PUT" })]);
  });

  it.each([
    // Create variants of broken servers
    [new MockOfflineServer("https://server1.com")],
    [new MockBrokenServer("https://server1.com")],
    [new MockUnauthorizedServer("https://server1.com")],
  ])("should fallback to second server if first fails (%s)", async (broken) => {
    mockServers = [broken, new MockServer("https://server2.com"), new MockServer("https://server3.com")];

    const onError = vi.fn();

    await multiServerUpload(
      mockServers.map((s) => s.url),
      uploadBlob,
      { onError },
    );

    // Attempt to upload to first server
    expect(mockServers[0].endpoints).toEqual([expect.objectContaining({ pathname: "/upload", method: "HEAD" })]);
    expect(onError).toHaveBeenCalledWith(mockServers[0].url, uploadHash, uploadBlob, expect.any(Error));

    // Fallback to second server
    expect(mockServers[1].endpoints).toEqual([
      expect.objectContaining({ pathname: "/upload", method: "HEAD" }),
      expect.objectContaining({ pathname: "/upload", method: "PUT" }),
    ]);

    // Mirror to other servers
    expect(mockServers[2].endpoints).toEqual([expect.objectContaining({ pathname: "/mirror", method: "PUT" })]);
  });

  it.each([
    // Create variants of broken servers
    [new MockOfflineServer("https://server2.com")],
    [new MockBrokenServer("https://server2.com")],
    [new MockUnauthorizedServer("https://server2.com")],
  ])("should handle broke (%s) mirror servers", async (broken) => {
    mockServers = [new MockServer("https://server1.com"), broken, new MockServer("https://server3.com")];

    const onError = vi.fn();

    await multiServerUpload(
      mockServers.map((s) => s.url),
      uploadBlob,
      { onError },
    );

    // Upload to first server
    expect(mockServers[0].endpoints).toEqual([
      expect.objectContaining({ pathname: "/upload", method: "HEAD" }),
      expect.objectContaining({ pathname: "/upload", method: "PUT" }),
    ]);

    // Should attempt to mirror to second broken server
    expect(mockServers[1].endpoints).toEqual([
      // First attempt to mirror
      expect.objectContaining({ pathname: "/mirror", method: "PUT" }),
      // Then attempt to upload
      expect.objectContaining({ pathname: "/upload", method: "HEAD" }),
    ]);
    expect(onError).toHaveBeenCalledWith(mockServers[1].url, uploadHash, uploadBlob, expect.any(Error));

    // Should mirror to third server
    expect(mockServers[2].endpoints).toEqual([expect.objectContaining({ pathname: "/mirror", method: "PUT" })]);
  });

  it("should call onError when server is unreachable", async () => {
    mockServers = [new MockOfflineServer("https://server2.com")];

    const onError = vi.fn();
    await multiServerUpload(
      mockServers.map((s) => s.url),
      uploadBlob,
      { onError },
    );

    expect(onError).toHaveBeenCalledWith(mockServers[0].url, uploadHash, uploadBlob, expect.any(Error));
  });

  describe("Authorization", () => {
    it("should call onAuth when authorization is required", async () => {
      mockServers = [new MockServerRequireAuth("https://server1.com"), new MockServer("https://server2.com")];

      const onAuth = vi.fn().mockResolvedValue(createUploadAuth(signer, uploadHash));
      await multiServerUpload(
        mockServers.map((s) => s.url),
        uploadBlob,
        { onAuth },
      );

      // Upload to first server and handle authorization
      expect(mockServers[0].endpoints).toEqual([
        expect.objectContaining({ pathname: "/upload", method: "HEAD" }),
        expect.objectContaining({
          pathname: "/upload",
          method: "PUT",
          headers: expect.objectContaining({ authorization: expect.any(String) }),
        }),
      ]);
      expect(onAuth).toHaveBeenCalledWith(mockServers[0].url, uploadHash, "upload", uploadBlob);

      // Should mirror to second server
      expect(mockServers[1].endpoints).toEqual([expect.objectContaining({ pathname: "/mirror", method: "PUT" })]);
    });

    it("should only call onAuth once upload and mirror", async () => {
      mockServers = [
        new MockServerRequireAuth("https://server1.com"),
        new MockServerRequireAuth("https://server2.com"),
      ];

      const onAuth = vi.fn().mockResolvedValue(createUploadAuth(signer, uploadHash));
      await multiServerUpload(
        mockServers.map((s) => s.url),
        uploadBlob,
        { onAuth },
      );

      expect(onAuth).toHaveBeenCalledTimes(1);
    });

    it("should call onError when server rejects auth", async () => {
      mockServers = [new MockUnauthorizedServer("https://server1.com"), new MockServer("https://server2.com")];

      const onAuth = vi.fn().mockResolvedValue(createUploadAuth(signer, uploadHash));
      const onError = vi.fn();
      await multiServerUpload(
        mockServers.map((s) => s.url),
        uploadBlob,
        { onError, onAuth },
      );

      // Attempt to upload to first server
      expect(mockServers[0].endpoints).toEqual([
        // Check upload requirements
        expect.objectContaining({ pathname: "/upload", method: "HEAD" }),
        // Request should be retried with auth
        expect.objectContaining({
          pathname: "/upload",
          method: "PUT",
          headers: expect.objectContaining({ authorization: expect.any(String) }),
        }),
      ]);
      expect(onError).toHaveBeenCalledWith(mockServers[0].url, uploadHash, uploadBlob, expect.any(Error));

      // Upload to second server
      expect(mockServers[1].endpoints).toEqual([
        expect.objectContaining({ pathname: "/upload", method: "HEAD" }),
        expect.objectContaining({ pathname: "/upload", method: "PUT" }),
      ]);
    });

    it("should not call onAuth if auth events were provided", async () => {
      mockServers = [new MockServerRequireAuth("https://server1.com"), new MockServer("https://server2.com")];

      const onAuth = vi.fn().mockResolvedValue(createUploadAuth(signer, uploadHash));
      await multiServerUpload(
        mockServers.map((s) => s.url),
        uploadBlob,
        { onAuth, auth: await createUploadAuth(signer, uploadHash) },
      );

      expect(onAuth).not.toHaveBeenCalled();
    });

    it("should call onError when onAuth handler is missing", async () => {
      mockServers = [new MockServerRequireAuth("https://server1.com"), new MockServer("https://server2.com")];

      const onError = vi.fn();
      await multiServerUpload(mockServers.map((s) => s.url), uploadBlob, { onError });
      expect(onError).toHaveBeenCalledWith(mockServers[0].url, uploadHash, uploadBlob, expect.any(Error));
    });
  });

  describe("Payment", () => {
    it("should call onPayment when payment is required for upload", async () => {
      mockServers = [new MockServerRequirePayment("https://server1.com"), new MockServer("https://server2.com")];

      const onPayment = vi.fn().mockResolvedValue({
        unit: "sats",
        memo: "test",
        proofs: [],
        mint: "https://fake.money",
      } satisfies PaymentToken);
      await multiServerUpload(
        mockServers.map((s) => s.url),
        uploadBlob,
        { onPayment },
      );

      // Upload to first server
      expect(mockServers[0].endpoints).toEqual([
        // Check upload requirements
        expect.objectContaining({ pathname: "/upload", method: "HEAD" }),
        // Try with payment
        expect.objectContaining({
          pathname: "/upload",
          method: "PUT",
          headers: expect.objectContaining({ "x-cashu": expect.any(String) }),
        }),
      ]);
      expect(onPayment).toHaveBeenCalledWith(
        mockServers[0].url,
        uploadHash,
        uploadBlob,
        expect.objectContaining({ amount: 1 }),
      );

      // Mirror to second server
      expect(mockServers[1].endpoints).toEqual([expect.objectContaining({ pathname: "/mirror", method: "PUT" })]);
    });

    it("should call onPayment when payment is required for mirror", async () => {
      mockServers = [new MockServer("https://server1.com"), new MockServerRequirePayment("https://server2.com")];

      const onPayment = vi.fn().mockResolvedValue("test-token");
      await multiServerUpload(
        mockServers.map((s) => s.url),
        uploadBlob,
        { onPayment },
      );

      expect(onPayment).toHaveBeenCalledWith(
        mockServers[1].url,
        uploadHash,
        uploadBlob,
        expect.objectContaining({ amount: 1 }),
      );
    });

    it("should call onPayment for each server", async () => {
      mockServers = [
        new MockServerRequirePayment("https://server1.com"),
        new MockServerRequirePayment("https://server2.com"),
      ];

      const onPayment = vi.fn().mockResolvedValue("test-token");
      await multiServerUpload(
        mockServers.map((s) => s.url),
        uploadBlob,
        { onPayment },
      );

      expect(onPayment).toHaveBeenCalledWith(
        mockServers[0].url,
        uploadHash,
        uploadBlob,
        expect.objectContaining({ amount: 1 }),
      );
      expect(onPayment).toHaveBeenCalledWith(
        mockServers[1].url,
        uploadHash,
        uploadBlob,
        expect.objectContaining({ amount: 1 }),
      );
    });

    it("should call onError when onPayment handler is missing", async () => {
      mockServers = [new MockServerRequirePayment("https://server1.com"), new MockServer("https://server2.com")];

      const onError = vi.fn();
      await multiServerUpload(mockServers.map((s) => s.url), uploadBlob, { onError });
      expect(onError).toHaveBeenCalledWith(mockServers[0].url, uploadHash, uploadBlob, expect.any(Error));
    });
  });

  describe("Media upload", () => {
    it("should call the media endpoint first", async () => {
      mockServers = [new MockServer("https://server1.com"), new MockServer("https://server2.com")];

      await multiServerUpload(
        mockServers.map((s) => s.url),
        uploadBlob,
        { isMedia: true },
      );

      // Upload media to first server
      expect(mockServers[0].endpoints).toEqual([
        // Check media upload requirements
        expect.objectContaining({ pathname: "/media", method: "HEAD" }),
        // Upload media
        expect.objectContaining({ pathname: "/media", method: "PUT" }),
      ]);

      // Mirror modified media to second server
      expect(mockServers[1].endpoints).toEqual([
        expect.objectContaining({
          pathname: "/mirror",
          method: "PUT",
          body: expect.objectContaining({ url: new URL(modifiedHash, mockServers[0].url).toString() }),
        }),
      ]);
    });

    it("should fallback to upload if media endpoint is not found and mediaUploadFallback=true", async () => {
      mockServers = [new MockServerNoMedia("https://server1.com"), new MockServer("https://server2.com")];

      const onError = vi.fn();
      await multiServerUpload(
        mockServers.map((s) => s.url),
        uploadBlob,
        { isMedia: true, mediaUploadFallback: true, onError },
      );

      // Attempt to upload media to first server
      expect(mockServers[0].endpoints).toEqual([
        expect.objectContaining({ pathname: "/media", method: "HEAD" }),
        expect.objectContaining({ pathname: "/upload", method: "HEAD" }),
        expect.objectContaining({ pathname: "/upload", method: "PUT" }),
      ]);

      // Mirror to second server
      expect(mockServers[1].endpoints).toEqual([
        expect.objectContaining({
          pathname: "/mirror",
          method: "PUT",
          body: expect.objectContaining({ url: new URL(uploadHash, mockServers[0].url).toString() }),
        }),
      ]);
    });

    it("should throw error if media endpoint is not found and mediaUploadFallback=false", async () => {
      mockServers = [new MockServerNoMedia("https://server1.com"), new MockServer("https://server2.com")];

      await expect(
        multiServerUpload(
          mockServers.map((s) => s.url),
          uploadBlob,
          { isMedia: true, mediaUploadFallback: false },
        ),
      ).rejects.toThrow();
    });

    it.each([
      [new MockOfflineServer("https://server1.com")],
      [new MockBrokenServer("https://server1.com")],
      [new MockUnauthorizedServer("https://server1.com")],
    ])("should throw error if first server is broken and mediaUploadFallback=false (%s)", async (broken) => {
      mockServers = [broken, new MockServer("https://server2.com")];

      await expect(
        multiServerUpload(
          mockServers.map((s) => s.url),
          uploadBlob,
          { isMedia: true, mediaUploadFallback: false },
        ),
      ).rejects.toThrow();
    });

    it("should upload to any server if mediaUploadBehavior=any", async () => {
      mockServers = [new MockServerNoMedia("https://server1.com"), new MockServer("https://server2.com")];

      await multiServerUpload(
        mockServers.map((s) => s.url),
        uploadBlob,
        { isMedia: true, mediaUploadBehavior: "any" },
      );

      // Attempt to upload media to first server
      expect(mockServers[0].endpoints).toEqual([
        // 1. Attempt to upload media to first server
        expect.objectContaining({ pathname: "/media", method: "HEAD" }),
        // 4. Mirror modified blob to first server
        expect.objectContaining({
          pathname: "/mirror",
          method: "PUT",
          body: expect.objectContaining({ url: new URL(modifiedHash, mockServers[1].url).toString() }),
        }),
      ]);

      // Upload media to second server
      expect(mockServers[1].endpoints).toEqual([
        // 2. Check media upload requirements
        expect.objectContaining({ pathname: "/media", method: "HEAD" }),
        // 3. Upload media
        expect.objectContaining({ pathname: "/media", method: "PUT" }),
      ]);
    });

    it("should throw error if mediaUploadBehavior=any and no server supports media", async () => {
      mockServers = [new MockServerNoMedia("https://server1.com"), new MockServerNoMedia("https://server2.com")];

      await expect(
        multiServerUpload(
          mockServers.map((s) => s.url),
          uploadBlob,
          { isMedia: true, mediaUploadBehavior: "any" },
        ),
      ).rejects.toThrow();
    });

    it("should upload to first server if mediaUploadBehavior=any and mediaUploadFallback=true", async () => {
      mockServers = [new MockServerNoMedia("https://server1.com"), new MockServerNoMedia("https://server2.com")];

      await multiServerUpload(
        mockServers.map((s) => s.url),
        uploadBlob,
        {
          isMedia: true,
          mediaUploadBehavior: "any",
          mediaUploadFallback: true,
        },
      );

      // First server requests
      expect(mockServers[0].endpoints).toEqual([
        // 1. Attempt to upload media to server
        expect.objectContaining({ pathname: "/media", method: "HEAD" }),
        // 3. Check upload requirements
        expect.objectContaining({ pathname: "/upload", method: "HEAD" }),
        // 4. Upload blob
        expect.objectContaining({ pathname: "/upload", method: "PUT" }),
      ]);

      // Second server requests
      expect(mockServers[1].endpoints).toEqual([
        // 2. Attempt to upload media to server
        expect.objectContaining({ pathname: "/media", method: "HEAD" }),
        // 5. Mirror modified blob to server
        expect.objectContaining({
          pathname: "/mirror",
          method: "PUT",
          body: expect.objectContaining({ url: new URL(uploadHash, mockServers[0].url).toString() }),
        }),
      ]);
    });
  });
});
