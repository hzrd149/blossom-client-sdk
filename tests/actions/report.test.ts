import { describe, expect, it, vi } from "vitest";
import { finalizeEvent, generateSecretKey } from "nostr-tools";

import { reportBlobs } from "../../src/actions/report.js";
import { EventTemplate, Signer } from "../../src/types.js";
import fetchMock from "../fetch.js";

const key = generateSecretKey();
const signer: Signer = async (t: EventTemplate) => finalizeEvent(t, key);

async function createReportEvent() {
  return signer({
    kind: 1984,
    created_at: Math.floor(Date.now() / 1000),
    content: "spam media",
    tags: [["x", "74f81fe167d99b4cb41d6d0ccda82278caee9f3e2f25d5e5a3936ff3dcec60d0", "spam"]],
  });
}

describe("reportBlobs", () => {
  const servers = ["https://one.example.com", "https://two.example.com"];

  it("should send the report event to each server", async () => {
    fetchMock.mockResponses(["", { status: 200 }], ["", { status: 200 }]);
    const report = await createReportEvent();

    const result = await reportBlobs(servers, report);

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.requests()[0].url).toBe("https://one.example.com/report");
    expect(fetchMock.requests()[1].url).toBe("https://two.example.com/report");
    expect(fetchMock.requests()[0].method).toBe("PUT");
    expect(fetchMock.requests()[0].headers.get("Content-Type")).toBe("application/json");
    await expect(fetchMock.requests()[0].json()).resolves.toEqual(JSON.parse(JSON.stringify(report)));
    expect(result).toEqual(
      new Map([
        [servers[0], true],
        [servers[1], true],
      ]),
    );
  });

  it("should continue when a server fails and call onError", async () => {
    fetchMock.mockResponses([JSON.stringify({ error: "Server error" }), { status: 500 }], ["", { status: 200 }]);
    const report = await createReportEvent();
    const onError = vi.fn();

    const result = await reportBlobs(servers, report, { onError });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(onError).toHaveBeenCalledTimes(1);
    expect(onError.mock.calls[0]?.[0]).toBe(servers[0]);
    expect(onError.mock.calls[0]?.[1]).toBeInstanceOf(Error);
    expect(result).toEqual(new Map([[servers[1], true]]));
  });

  it("should reject invalid report events", async () => {
    const invalidReport = await signer({
      kind: 1,
      created_at: Math.floor(Date.now() / 1000),
      content: "not a blob report",
      tags: [],
    });

    await expect(reportBlobs(servers, invalidReport)).rejects.toThrow("Invalid blob report event");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("should respect the AbortSignal", async () => {
    fetchMock.mockResponseOnce("");
    const report = await createReportEvent();
    const controller = new AbortController();

    const promise = reportBlobs([servers[0]], report, { signal: controller.signal });
    controller.abort();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    await expect(promise).rejects.toThrow();
  });

  it("should use the provided timeout", async () => {
    fetchMock.mockResponseOnce(() => {
      return new Promise((resolve) => {
        setTimeout(() => resolve({ body: "", status: 200 }), 100);
      });
    });
    const report = await createReportEvent();

    await expect(reportBlobs([servers[0]], report, { timeout: 10 })).rejects.toThrow();
  });
});
