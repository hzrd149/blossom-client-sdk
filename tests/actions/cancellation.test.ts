import { describe, expect, it, vi } from "vitest";
import { resolveBlob } from "../../src/actions/resolve.js";
import { multiServerMediaUpload, multiServerUpload } from "../../src/actions/multi-server.js";
import fetchMock from "../fetch.js";

const servers = ["https://one.example", "https://two.example"];
const hash = "a".repeat(64);
const uri = `blossom:${hash}.txt?xs=one.example&as=${"b".repeat(64)}`;
const blob = new Blob(["data"]);
const descriptor = { url: `${servers[0]}/${hash}`, sha256: hash, size: 4, uploaded: 1 };

it("stops URI resolution without looking up authors or trying fallback servers", async () => {
  const controller = new AbortController();
  const reason = new Error("Cancelled by caller");
  const getServers = vi.fn(async () => servers);
  fetchMock.mockImplementationOnce(async () => {
    controller.abort(reason);
    throw reason;
  });

  await expect(
    resolveBlob(uri, { signal: controller.signal, timeout: 1000, getServers, fallbackServers: servers }),
  ).rejects.toBe(reason);
  expect(fetchMock).toHaveBeenCalledTimes(1);
  expect(getServers).not.toHaveBeenCalled();
});

it("does not start a request when URI resolution is already cancelled", async () => {
  const reason = new Error("Already stopped");
  await expect(resolveBlob(uri, { signal: AbortSignal.abort(reason), timeout: 1000 })).rejects.toBe(reason);
  expect(fetchMock).not.toHaveBeenCalled();
});

it("does not start uploads after preflight cancellation", async () => {
  const controller = new AbortController();
  const reason = new Error("Stop preflight");
  fetchMock.mockImplementation(async () => {
    controller.abort(reason);
    throw reason;
  });
  const onError = vi.fn();
  await expect(multiServerUpload(servers, blob, { signal: controller.signal, onError })).rejects.toBe(reason);
  expect(fetchMock).toHaveBeenCalledTimes(2);
  expect(onError).not.toHaveBeenCalled();
});

describe.each([multiServerUpload, multiServerMediaUpload])("%s cancellation", (upload) => {
  it("does not start when already cancelled", async () => {
    const reason = new Error("Already stopped");
    await expect(upload(servers, blob, { signal: AbortSignal.abort(reason) })).rejects.toBe(reason);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("propagates mirror cancellation without falling back or reporting a server failure", async () => {
    const controller = new AbortController();
    const reason = new Error("Stop mirror");
    fetchMock.mockResponses(["", { status: 200 }], [JSON.stringify(descriptor), { status: 200 }]);
    fetchMock.mockImplementationOnce(async () => {
      controller.abort(reason);
      throw reason;
    });
    const onError = vi.fn();
    await expect(
      upload([...servers, "https://three.example"], blob, {
        preflight: false,
        signal: controller.signal,
        onError,
      }),
    ).rejects.toBe(reason);
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(onError).not.toHaveBeenCalled();
  });
});
