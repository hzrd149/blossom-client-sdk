import { describe, expect, it, vi } from "vitest";
import { uploadBlob } from "../../src/actions/upload.js";
import { uploadMedia } from "../../src/actions/media.js";
import { downloadBlob } from "../../src/actions/download.js";
import { deleteBlob } from "../../src/actions/delete.js";
import { listBlobs } from "../../src/actions/list.js";
import { mirrorBlob } from "../../src/actions/mirror.js";
import { encodeAuthorizationHeader } from "../../src/auth.js";
import type { SignedEvent } from "../../src/types.js";
import fetchMock from "../fetch.js";

const server = "https://example.com";
const hash = "a".repeat(64);
const blob = new Blob(["data"]);
const descriptor = { url: `${server}/${hash}`, sha256: hash, size: 4, uploaded: 1 };
const auth: SignedEvent = { id: "", sig: "", pubkey: "", kind: 24242, created_at: 1, tags: [], content: "" };
type Options = {
  onAuth: () => Promise<SignedEvent>;
  onPaymentRequired: () => Promise<HeadersInit>;
};
const cases = [
  { name: "upload", run: (opts: Options) => uploadBlob(server, blob, opts), preflight: true },
  { name: "media", run: (opts: Options) => uploadMedia(server, blob, opts), preflight: true },
  { name: "download", run: (opts: Options) => downloadBlob(server, hash, opts), preflight: false },
  { name: "delete", run: (opts: Options) => deleteBlob(server, hash, opts), preflight: false },
  { name: "list", run: (opts: Options) => listBlobs(server, hash, opts), preflight: false },
  { name: "mirror", run: (opts: Options) => mirrorBlob(server, descriptor, opts), preflight: false },
];

describe.each(cases)("$name challenge handling", ({ run, preflight }) => {
  it.each([
    [401, 402],
    [402, 401],
  ])("handles %i then %i and preserves headers", async (first, second) => {
    fetchMock.mockResponses(
      ["", { status: first }],
      ["", { status: second }],
      [JSON.stringify(descriptor), { status: 200 }],
    );
    const onAuth = vi.fn(async () => auth);
    const onPaymentRequired = vi.fn(async () => ({ "X-Payment": "paid" }));
    await run({ onAuth, onPaymentRequired });

    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(onAuth).toHaveBeenCalledTimes(1);
    expect(onPaymentRequired).toHaveBeenCalledTimes(1);
    const last = fetchMock.requests()[2];
    expect(last.headers.get("Authorization")).toBe(encodeAuthorizationHeader(auth));
    expect(last.headers.get("X-Payment")).toBe("paid");
    if (preflight) expect(last.method).toBe("PUT");
  });

  it.each([401, 402])("does not repeat a rejected %i challenge", async (status) => {
    fetchMock.mockResponses(["", { status }], ["", { status }]);
    const opts = {
      onAuth: vi.fn(async () => auth),
      onPaymentRequired: vi.fn(async () => ({ "X-Payment": "paid" })),
    };
    await expect(run(opts)).rejects.toMatchObject({ status });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(status === 401 ? opts.onAuth : opts.onPaymentRequired).toHaveBeenCalledTimes(1);
  });
});

describe.each([uploadBlob, uploadMedia])("%s post-preflight challenges", (upload) => {
  it("handles auth and payment after a successful HEAD", async () => {
    fetchMock.mockResponses(
      ["", { status: 200 }],
      ["", { status: 401 }],
      ["", { status: 402 }],
      [JSON.stringify(descriptor), { status: 200 }],
    );
    await upload(server, blob, {
      onAuth: async () => auth,
      onPaymentRequired: async () => ({ "X-Payment": "paid" }),
    });
    expect(fetchMock.requests().map((r) => r.method)).toEqual(["HEAD", "PUT", "PUT", "PUT"]);
    expect(fetchMock.requests()[3].headers.get("X-Payment")).toBe("paid");
    expect(fetchMock.requests()[3].headers.get("Authorization")).toBe(encodeAuthorizationHeader(auth));
  });
});
