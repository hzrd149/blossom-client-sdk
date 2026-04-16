import { describe, expect, it, vi } from "vitest";
import { resolveBlob } from "../../src/actions/resolve";
import fetchMock from "../fetch";

const HASH = "b1674191a88ec5cdd733e4240a81803105dc412d6c6708d53ab94fc248f4f553";
const PUBKEY = "266815e0c9210dfa324c6cba3573b14bee49da4209a9456f9484e5106cd408a5";

describe("resolveBlob", () => {
  it("should download from the first server that has the blob", async () => {
    fetchMock.mockResponses(
      ["", { status: 404 }], // GET server1 -> not found
      ["blob data", { status: 200 }], // GET server2 -> success
    );

    const uri = `blossom:${HASH}.png?xs=https://server1.com&xs=https://server2.com`;
    const res = await resolveBlob(uri);

    expect(await res.text()).toBe("blob data");
    expect(fetchMock).toHaveBeenCalledTimes(2);

    expect(fetchMock.requests()[0].method).toBe("GET");
    expect(fetchMock.requests()[0].url).toBe(`https://server1.com/${HASH}`);
    expect(fetchMock.requests()[1].method).toBe("GET");
    expect(fetchMock.requests()[1].url).toBe(`https://server2.com/${HASH}`);
  });

  it("should return response from first server when successful", async () => {
    fetchMock.mockResponses(
      ["blob data", { status: 200 }], // GET server1 -> success
    );

    const uri = `blossom:${HASH}.png?xs=https://server1.com&xs=https://server2.com`;
    const res = await resolveBlob(uri);

    expect(await res.text()).toBe("blob data");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("should resolve author hints via getServers callback", async () => {
    fetchMock.mockResponses(
      ["blob data", { status: 200 }], // GET author-server
    );

    const getServers = vi.fn().mockResolvedValue(["https://author-server.com"]);

    const uri = `blossom:${HASH}.png?as=${PUBKEY}`;
    const res = await resolveBlob(uri, { getServers });

    expect(getServers).toHaveBeenCalledWith(PUBKEY);
    expect(await res.text()).toBe("blob data");
    expect(fetchMock.requests()[0].url).toBe(`https://author-server.com/${HASH}`);
  });

  it("should NOT resolve author hints if xs server succeeds", async () => {
    fetchMock.mockResponses(
      ["blob data", { status: 200 }], // GET xs-server -> success
    );

    const getServers = vi.fn().mockResolvedValue(["https://author-server.com"]);

    const uri = `blossom:${HASH}.png?xs=https://xs-server.com&as=${PUBKEY}`;
    const res = await resolveBlob(uri, { getServers });

    expect(await res.text()).toBe("blob data");
    expect(getServers).not.toHaveBeenCalled();
  });

  it("should resolve author hints only after all xs servers fail", async () => {
    fetchMock.mockResponses(
      ["", { status: 404 }], // GET xs1 -> not found
      ["", { status: 404 }], // GET xs2 -> not found
      ["blob data", { status: 200 }], // GET author-server -> success
    );

    const getServers = vi.fn().mockResolvedValue(["https://author-server.com"]);

    const uri = `blossom:${HASH}.png?xs=https://xs1.com&xs=https://xs2.com&as=${PUBKEY}`;
    const res = await resolveBlob(uri, { getServers });

    expect(await res.text()).toBe("blob data");
    expect(getServers).toHaveBeenCalledWith(PUBKEY);
    expect(fetchMock.requests()[0].url).toBe(`https://xs1.com/${HASH}`);
    expect(fetchMock.requests()[1].url).toBe(`https://xs2.com/${HASH}`);
    expect(fetchMock.requests()[2].url).toBe(`https://author-server.com/${HASH}`);
  });

  it("should try fallback servers after URI hints", async () => {
    fetchMock.mockResponses(
      ["", { status: 404 }], // GET xs-server -> not found
      ["blob data", { status: 200 }], // GET fallback -> success
    );

    const uri = `blossom:${HASH}.png?xs=https://xs-server.com`;
    const res = await resolveBlob(uri, { fallbackServers: ["https://fallback.com"] });

    expect(await res.text()).toBe("blob data");
    expect(fetchMock.requests()[1].url).toBe(`https://fallback.com/${HASH}`);
  });

  it("should try fallback servers only after author hints fail", async () => {
    fetchMock.mockResponses(
      ["", { status: 404 }], // GET xs-server
      ["", { status: 404 }], // GET author-server
      ["blob data", { status: 200 }], // GET fallback
    );

    const getServers = vi.fn().mockResolvedValue(["https://author-server.com"]);

    const uri = `blossom:${HASH}.png?xs=https://xs-server.com&as=${PUBKEY}`;
    const res = await resolveBlob(uri, { getServers, fallbackServers: ["https://fallback.com"] });

    expect(await res.text()).toBe("blob data");
    expect(fetchMock.requests()[0].url).toBe(`https://xs-server.com/${HASH}`);
    expect(fetchMock.requests()[1].url).toBe(`https://author-server.com/${HASH}`);
    expect(fetchMock.requests()[2].url).toBe(`https://fallback.com/${HASH}`);
  });

  it("should deduplicate servers", async () => {
    fetchMock.mockResponses(
      ["blob data", { status: 200 }], // GET server
    );

    const uri = `blossom:${HASH}.png?xs=https://server.com`;
    await resolveBlob(uri, { fallbackServers: ["https://server.com"] });

    // only 1 call, not 2 (deduped)
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("should throw when no servers are available", async () => {
    const uri = `blossom:${HASH}.png`;
    await expect(resolveBlob(uri)).rejects.toThrow("No servers available");
  });

  it("should throw when blob is not found on any server", async () => {
    fetchMock.mockResponses(
      ["", { status: 404 }], // GET server1
      ["", { status: 404 }], // GET server2
    );

    const uri = `blossom:${HASH}.png?xs=https://server1.com&xs=https://server2.com`;
    await expect(resolveBlob(uri)).rejects.toThrow("not found on any server");
  });

  it("should skip servers that fail with network errors", async () => {
    fetchMock.mockResponses(
      [
        () => {
          throw new Error("Network error");
        },
        { status: 500 },
      ],
      ["blob data", { status: 200 }], // GET server2
    );

    const uri = `blossom:${HASH}.png?xs=https://broken.com&xs=https://server2.com`;
    const res = await resolveBlob(uri);
    expect(await res.text()).toBe("blob data");
  });

  it("should accept a pre-parsed BlossomURI object", async () => {
    fetchMock.mockResponses(
      ["blob data", { status: 200 }], // GET server
    );

    const res = await resolveBlob({ sha256: HASH, ext: "png", servers: ["https://server.com"], authors: [] });

    expect(await res.text()).toBe("blob data");
  });

  it("should normalize bare domain xs hints to https", async () => {
    fetchMock.mockResponses(
      ["blob data", { status: 200 }], // GET server
    );

    const uri = `blossom:${HASH}.png?xs=cdn.example.com`;
    await resolveBlob(uri);

    expect(fetchMock.requests()[0].url).toBe(`https://cdn.example.com/${HASH}`);
  });
});
