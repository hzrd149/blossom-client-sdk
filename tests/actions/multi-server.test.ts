import { beforeEach, describe, expect, it, vi } from "vitest";

import { finalizeEvent, generateSecretKey } from "nostr-tools";
import { multiServerUpload, multiServerMediaUpload } from "../../src/actions/multi-server.js";
import { createUploadAuth } from "../../src/auth";
import { EventTemplate, PaymentToken, Signer } from "../../src/types.js";
import fetchMock from "../fetch.js";
import HTTPError from "../../src/error.js";
import {
  expectNoErrors,
  MockBrokenServer,
  MockOfflineServer,
  MockServer,
  MockServerHasBlob,
  MockServerNoMedia,
  MockServerRejectsTooLarge,
  MockServerRejectsType,
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

    // Upload to first server (preflight HEAD + upload)
    expect(mockServers[0].endpoints).toEqual([
      expect.objectContaining({ pathname: "/" + uploadHash, method: "HEAD" }),
      expect.objectContaining({ pathname: "/upload", method: "HEAD" }),
      expect.objectContaining({ pathname: "/upload", method: "PUT" }),
    ]);

    // Mirror to second server (preflight HEAD + mirror)
    expect(mockServers[1].endpoints).toEqual([
      expect.objectContaining({ pathname: "/" + uploadHash, method: "HEAD" }),
      expect.objectContaining({ pathname: "/mirror", method: "PUT" }),
    ]);

    // Mirror to third server (preflight HEAD + mirror)
    expect(mockServers[2].endpoints).toEqual([
      expect.objectContaining({ pathname: "/" + uploadHash, method: "HEAD" }),
      expect.objectContaining({ pathname: "/mirror", method: "PUT" }),
    ]);
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

    // Attempt to upload to first server (preflight may fail for offline/broken servers)
    expect(onError).toHaveBeenCalledWith(mockServers[0].url, uploadHash, uploadBlob, expect.any(Error));

    // Fallback to second server
    expect(mockServers[1].endpoints).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ pathname: "/upload", method: "HEAD" }),
        expect.objectContaining({ pathname: "/upload", method: "PUT" }),
      ]),
    );

    // Mirror to other servers
    expect(mockServers[2].endpoints).toEqual(
      expect.arrayContaining([expect.objectContaining({ pathname: "/mirror", method: "PUT" })]),
    );
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
      expect.objectContaining({ pathname: "/" + uploadHash, method: "HEAD" }),
      expect.objectContaining({ pathname: "/upload", method: "HEAD" }),
      expect.objectContaining({ pathname: "/upload", method: "PUT" }),
    ]);

    // Should attempt to mirror to second broken server (preflight + mirror + upload fallback)
    expect(mockServers[1].endpoints).toEqual(
      expect.arrayContaining([
        // Attempt to mirror
        expect.objectContaining({ pathname: "/mirror", method: "PUT" }),
        // Then attempt to upload
        expect.objectContaining({ pathname: "/upload", method: "HEAD" }),
      ]),
    );
    expect(onError).toHaveBeenCalledWith(mockServers[1].url, uploadHash, uploadBlob, expect.any(Error));

    // Should mirror to third server
    expect(mockServers[2].endpoints).toEqual(
      expect.arrayContaining([expect.objectContaining({ pathname: "/mirror", method: "PUT" })]),
    );
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
      expect(mockServers[0].endpoints).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ pathname: "/upload", method: "HEAD" }),
          expect.objectContaining({
            pathname: "/upload",
            method: "PUT",
            headers: expect.objectContaining({ authorization: expect.any(String) }),
          }),
        ]),
      );
      expect(onAuth).toHaveBeenCalledWith(mockServers[0].url, uploadHash, "upload", uploadBlob);

      // Should mirror to second server
      expect(mockServers[1].endpoints).toEqual(
        expect.arrayContaining([expect.objectContaining({ pathname: "/mirror", method: "PUT" })]),
      );
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
      expect(mockServers[0].endpoints).toEqual(
        expect.arrayContaining([
          // Check upload requirements
          expect.objectContaining({ pathname: "/upload", method: "HEAD" }),
          // Request should be retried with auth
          expect.objectContaining({
            pathname: "/upload",
            method: "PUT",
            headers: expect.objectContaining({ authorization: expect.any(String) }),
          }),
        ]),
      );
      expect(onError).toHaveBeenCalledWith(mockServers[0].url, uploadHash, uploadBlob, expect.any(Error));

      // Upload to second server
      expect(mockServers[1].endpoints).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ pathname: "/upload", method: "HEAD" }),
          expect.objectContaining({ pathname: "/upload", method: "PUT" }),
        ]),
      );
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
      await multiServerUpload(
        mockServers.map((s) => s.url),
        uploadBlob,
        { onError },
      );
      expect(onError).toHaveBeenCalledWith(mockServers[0].url, uploadHash, uploadBlob, expect.any(Error));
    });

    it("should reuse auth events for multiple servers", async () => {
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

    it("should set authorization header on all requests if auth=true", async () => {
      mockServers = [new MockServer("https://server1.com"), new MockServer("https://server2.com")];

      const onAuth = vi.fn().mockResolvedValue(createUploadAuth(signer, uploadHash));
      await multiServerUpload(
        mockServers.map((s) => s.url),
        uploadBlob,
        { onAuth, auth: true },
      );

      // it should send authorization header on all requests
      expect(mockServers[0].endpoints).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            pathname: "/upload",
            method: "HEAD",
            headers: expect.objectContaining({ authorization: expect.any(String) }),
          }),
          expect.objectContaining({
            pathname: "/upload",
            method: "PUT",
            headers: expect.objectContaining({ authorization: expect.any(String) }),
          }),
        ]),
      );

      expect(mockServers[1].endpoints).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            pathname: "/mirror",
            method: "PUT",
            headers: expect.objectContaining({ authorization: expect.any(String) }),
          }),
        ]),
      );
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
      expect(mockServers[0].endpoints).toEqual(
        expect.arrayContaining([
          // Check upload requirements
          expect.objectContaining({ pathname: "/upload", method: "HEAD" }),
          // Try with payment
          expect.objectContaining({
            pathname: "/upload",
            method: "PUT",
            headers: expect.objectContaining({ "x-cashu": expect.any(String) }),
          }),
        ]),
      );
      expect(onPayment).toHaveBeenCalledWith(
        mockServers[0].url,
        uploadHash,
        uploadBlob,
        expect.objectContaining({ amount: 1 }),
      );

      // Mirror to second server
      expect(mockServers[1].endpoints).toEqual(
        expect.arrayContaining([expect.objectContaining({ pathname: "/mirror", method: "PUT" })]),
      );
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
      await multiServerUpload(
        mockServers.map((s) => s.url),
        uploadBlob,
        { onError },
      );
      expect(onError).toHaveBeenCalledWith(mockServers[0].url, uploadHash, uploadBlob, expect.any(Error));
    });
  });

  describe("Media upload (multiServerMediaUpload)", () => {
    it("should call the media endpoint first then mirror to other servers", async () => {
      mockServers = [new MockServer("https://server1.com"), new MockServer("https://server2.com")];

      await multiServerMediaUpload(
        mockServers.map((s) => s.url),
        uploadBlob,
      );

      // Upload media to first server
      expect(mockServers[0].endpoints).toEqual([
        expect.objectContaining({ pathname: "/media", method: "HEAD" }),
        expect.objectContaining({ pathname: "/media", method: "PUT" }),
      ]);

      // Mirror modified media to second server (preflight HEAD + mirror)
      expect(mockServers[1].endpoints).toEqual([
        expect.objectContaining({ pathname: "/" + modifiedHash, method: "HEAD" }),
        expect.objectContaining({
          pathname: "/mirror",
          method: "PUT",
          body: expect.objectContaining({ url: new URL(modifiedHash, mockServers[0].url).toString() }),
        }),
      ]);
    });

    it("should fallback to regular upload if media endpoint is not found and mediaUploadFallback=true", async () => {
      mockServers = [new MockServerNoMedia("https://server1.com"), new MockServer("https://server2.com")];

      const onError = vi.fn();
      await multiServerMediaUpload(
        mockServers.map((s) => s.url),
        uploadBlob,
        { mediaUploadFallback: true, onError },
      );

      // Falls back to regular multiServerUpload: preflight + upload on first, preflight + mirror on second
      expect(mockServers[0].endpoints).toEqual([
        expect.objectContaining({ pathname: "/media", method: "HEAD" }),
        expect.objectContaining({ pathname: "/" + uploadHash, method: "HEAD" }),
        expect.objectContaining({ pathname: "/upload", method: "HEAD" }),
        expect.objectContaining({ pathname: "/upload", method: "PUT" }),
      ]);

      expect(mockServers[1].endpoints).toEqual([
        expect.objectContaining({ pathname: "/" + uploadHash, method: "HEAD" }),
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
        multiServerMediaUpload(
          mockServers.map((s) => s.url),
          uploadBlob,
          { mediaUploadFallback: false },
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
        multiServerMediaUpload(
          mockServers.map((s) => s.url),
          uploadBlob,
          { mediaUploadFallback: false },
        ),
      ).rejects.toThrow();
    });

    it("should upload to any server if mediaUploadBehavior=any", async () => {
      mockServers = [new MockServerNoMedia("https://server1.com"), new MockServer("https://server2.com")];

      await multiServerMediaUpload(
        mockServers.map((s) => s.url),
        uploadBlob,
        { mediaUploadBehavior: "any" },
      );

      // First server: media fail + preflight + mirror
      expect(mockServers[0].endpoints).toEqual([
        expect.objectContaining({ pathname: "/media", method: "HEAD" }),
        expect.objectContaining({ pathname: "/" + modifiedHash, method: "HEAD" }),
        expect.objectContaining({
          pathname: "/mirror",
          method: "PUT",
          body: expect.objectContaining({ url: new URL(modifiedHash, mockServers[1].url).toString() }),
        }),
      ]);

      // Second server: media upload
      expect(mockServers[1].endpoints).toEqual([
        expect.objectContaining({ pathname: "/media", method: "HEAD" }),
        expect.objectContaining({ pathname: "/media", method: "PUT" }),
      ]);
    });

    it("should throw error if mediaUploadBehavior=any and no server supports media", async () => {
      mockServers = [new MockServerNoMedia("https://server1.com"), new MockServerNoMedia("https://server2.com")];

      await expect(
        multiServerMediaUpload(
          mockServers.map((s) => s.url),
          uploadBlob,
          { mediaUploadBehavior: "any" },
        ),
      ).rejects.toThrow();
    });

    it("should fallback to regular upload if mediaUploadBehavior=any and mediaUploadFallback=true", async () => {
      mockServers = [new MockServerNoMedia("https://server1.com"), new MockServerNoMedia("https://server2.com")];

      await multiServerMediaUpload(
        mockServers.map((s) => s.url),
        uploadBlob,
        {
          mediaUploadBehavior: "any",
          mediaUploadFallback: true,
        },
      );

      // Falls back to regular multiServerUpload
      // First server: media fail + preflight + upload
      expect(mockServers[0].endpoints).toEqual([
        expect.objectContaining({ pathname: "/media", method: "HEAD" }),
        expect.objectContaining({ pathname: "/" + uploadHash, method: "HEAD" }),
        expect.objectContaining({ pathname: "/upload", method: "HEAD" }),
        expect.objectContaining({ pathname: "/upload", method: "PUT" }),
      ]);

      // Second server: media fail + preflight + mirror
      expect(mockServers[1].endpoints).toEqual([
        expect.objectContaining({ pathname: "/media", method: "HEAD" }),
        expect.objectContaining({ pathname: "/" + uploadHash, method: "HEAD" }),
        expect.objectContaining({
          pathname: "/mirror",
          method: "PUT",
          body: expect.objectContaining({ url: new URL(uploadHash, mockServers[0].url).toString() }),
        }),
      ]);
    });

    it("should use media-processed sha256 for preflight after media upload", async () => {
      mockServers = [new MockServer("https://server1.com"), new MockServer("https://server2.com")];

      await multiServerMediaUpload(
        mockServers.map((s) => s.url),
        uploadBlob,
        { onError: expectNoErrors },
      );

      // Second server preflight should check the modified hash, not the original
      expect(mockServers[1].endpoints).toEqual([
        expect.objectContaining({ pathname: "/" + modifiedHash, method: "HEAD" }),
        expect.objectContaining({ pathname: "/mirror", method: "PUT" }),
      ]);
    });
  });

  describe("Preflight", () => {
    it("should use mirror instead of upload when server already has blob", async () => {
      mockServers = [new MockServer("https://server1.com"), new MockServerHasBlob("https://server2.com")];

      await multiServerUpload(
        mockServers.map((s) => s.url),
        uploadBlob,
        { onError: expectNoErrors },
      );

      // First server: preflight (404) + upload
      expect(mockServers[0].endpoints).toEqual([
        expect.objectContaining({ pathname: "/" + uploadHash, method: "HEAD" }),
        expect.objectContaining({ pathname: "/upload", method: "HEAD" }),
        expect.objectContaining({ pathname: "/upload", method: "PUT" }),
      ]);

      // Second server: preflight (200) + mirror only, no upload fallback
      expect(mockServers[1].endpoints).toEqual([
        expect.objectContaining({ pathname: "/" + uploadHash, method: "HEAD" }),
        expect.objectContaining({ pathname: "/mirror", method: "PUT" }),
      ]);
    });

    it("should skip preflight when preflight=false", async () => {
      mockServers = [new MockServer("https://server1.com"), new MockServer("https://server2.com")];

      await multiServerUpload(
        mockServers.map((s) => s.url),
        uploadBlob,
        { preflight: false, onError: expectNoErrors },
      );

      // No HEAD /<sha256> requests
      expect(mockServers[0].endpoints).toEqual([
        expect.objectContaining({ pathname: "/upload", method: "HEAD" }),
        expect.objectContaining({ pathname: "/upload", method: "PUT" }),
      ]);

      expect(mockServers[1].endpoints).toEqual([expect.objectContaining({ pathname: "/mirror", method: "PUT" })]);
    });

    it("should handle preflight failures gracefully", async () => {
      mockServers = [
        new MockServer("https://server1.com"),
        new MockOfflineServer("https://server2.com"),
        new MockServer("https://server3.com"),
      ];

      const onError = vi.fn();
      await multiServerUpload(
        mockServers.map((s) => s.url),
        uploadBlob,
        { onError },
      );

      // First server still uploads successfully
      expect(mockServers[0].endpoints).toEqual(
        expect.arrayContaining([expect.objectContaining({ pathname: "/upload", method: "PUT" })]),
      );

      // Third server still mirrors successfully
      expect(mockServers[2].endpoints).toEqual(
        expect.arrayContaining([expect.objectContaining({ pathname: "/mirror", method: "PUT" })]),
      );
    });

    it("should not fall back to upload when server has blob but mirror fails", async () => {
      const serverWithBlob = new MockServerHasBlob("https://server2.com");
      // Make mirror fail on this server
      serverWithBlob.mirror.mockReturnValue({ status: 500 });

      mockServers = [new MockServer("https://server1.com"), serverWithBlob];

      const onError = vi.fn();
      await multiServerUpload(
        mockServers.map((s) => s.url),
        uploadBlob,
        { onError },
      );

      // Server2: preflight (200) + mirror attempt (fails) — no upload fallback
      const server2Pathnames = mockServers[1].endpoints.map((e) => e.pathname);
      expect(server2Pathnames).toContain("/mirror");
      expect(server2Pathnames).not.toContain("/upload");
    });
  });

  describe("Rejection", () => {
    it("should call onRejection when server returns 413", async () => {
      mockServers = [new MockServerRejectsTooLarge("https://server1.com"), new MockServer("https://server2.com")];

      const onRejection = vi.fn().mockReturnValue("skip");
      await multiServerUpload(
        mockServers.map((s) => s.url),
        uploadBlob,
        { onRejection },
      );

      expect(onRejection).toHaveBeenCalledWith(
        mockServers[0].url,
        uploadHash,
        uploadBlob,
        expect.objectContaining({ status: 413, code: "too_large" }),
      );
    });

    it("should call onRejection when server returns 415", async () => {
      mockServers = [new MockServerRejectsType("https://server1.com"), new MockServer("https://server2.com")];

      const onRejection = vi.fn().mockReturnValue("skip");
      await multiServerUpload(
        mockServers.map((s) => s.url),
        uploadBlob,
        { onRejection },
      );

      expect(onRejection).toHaveBeenCalledWith(
        mockServers[0].url,
        uploadHash,
        uploadBlob,
        expect.objectContaining({ status: 415, code: "unsupported_type" }),
      );
    });

    it("should skip server when onRejection returns 'skip'", async () => {
      mockServers = [
        new MockServerRejectsTooLarge("https://server1.com"),
        new MockServer("https://server2.com"),
        new MockServer("https://server3.com"),
      ];

      const onRejection = vi.fn().mockReturnValue("skip");
      const onError = vi.fn();
      const results = await multiServerUpload(
        mockServers.map((s) => s.url),
        uploadBlob,
        { onRejection, onError },
      );

      // onError should NOT be called for the rejection
      expect(onError).not.toHaveBeenCalled();

      // server2 and server3 should still succeed
      expect(results.size).toBe(2);
      expect(results.has(mockServers[1].url)).toBe(true);
      expect(results.has(mockServers[2].url)).toBe(true);
    });

    it("should cancel upload when onRejection returns 'cancel'", async () => {
      mockServers = [
        new MockServer("https://server1.com"),
        new MockServerRejectsTooLarge("https://server2.com"),
        new MockServer("https://server3.com"),
      ];

      const onRejection = vi.fn().mockReturnValue("cancel");
      const results = await multiServerUpload(
        mockServers.map((s) => s.url),
        uploadBlob,
        { onRejection },
      );

      // Should have partial results — server1 succeeded before server2 cancelled
      expect(results.size).toBe(1);
      expect(results.has(mockServers[0].url)).toBe(true);
    });

    it("should fall through to onError when onRejection is not provided", async () => {
      mockServers = [new MockServerRejectsTooLarge("https://server1.com"), new MockServer("https://server2.com")];

      const onError = vi.fn();
      await multiServerUpload(
        mockServers.map((s) => s.url),
        uploadBlob,
        { onError },
      );

      expect(onError).toHaveBeenCalledWith(mockServers[0].url, uploadHash, uploadBlob, expect.any(HTTPError));
    });

    it("should surface rejection with correct code for 409 conflict", async () => {
      const conflictServer = new MockServer("https://server1.com");
      conflictServer.upload.mockReturnValue({ status: 409, headers: { "x-reason": "SHA-256 mismatch" } });
      mockServers = [conflictServer, new MockServer("https://server2.com")];

      const onRejection = vi.fn().mockReturnValue("skip");
      await multiServerUpload(
        mockServers.map((s) => s.url),
        uploadBlob,
        { onRejection },
      );

      expect(onRejection).toHaveBeenCalledWith(
        mockServers[0].url,
        uploadHash,
        uploadBlob,
        expect.objectContaining({ status: 409, code: "conflict" }),
      );
    });
  });
});
