import { describe, expect, it, vi } from "vitest";
import { getBlobUrls } from "../../src/actions/resolve";

const HASH = "b1674191a88ec5cdd733e4240a81803105dc412d6c6708d53ab94fc248f4f553";
const PUBKEY = "266815e0c9210dfa324c6cba3573b14bee49da4209a9456f9484e5106cd408a5";

describe("getBlobUrls", () => {
  it("should return URLs from xs server hints", async () => {
    const uri = `blossom:${HASH}.png?xs=https://server1.com&xs=https://server2.com`;
    const urls = await getBlobUrls(uri);

    expect(urls).toEqual([`https://server1.com/${HASH}.png`, `https://server2.com/${HASH}.png`]);
  });

  it("should resolve author hints via getServers callback", async () => {
    const getServers = vi.fn().mockResolvedValue(["https://author-server.com"]);

    const uri = `blossom:${HASH}.png?as=${PUBKEY}`;
    const urls = await getBlobUrls(uri, { getServers });

    expect(getServers).toHaveBeenCalledWith(PUBKEY);
    expect(urls).toEqual([`https://author-server.com/${HASH}.png`]);
  });

  it("should include xs, author, and fallback servers in order", async () => {
    const getServers = vi.fn().mockResolvedValue(["https://author-server.com"]);

    const uri = `blossom:${HASH}.png?xs=https://xs-server.com&as=${PUBKEY}`;
    const urls = await getBlobUrls(uri, {
      getServers,
      fallbackServers: ["https://fallback.com"],
    });

    expect(urls).toEqual([
      `https://xs-server.com/${HASH}.png`,
      `https://author-server.com/${HASH}.png`,
      `https://fallback.com/${HASH}.png`,
    ]);
  });

  it("should deduplicate servers", async () => {
    const uri = `blossom:${HASH}.png?xs=https://server.com`;
    const urls = await getBlobUrls(uri, { fallbackServers: ["https://server.com"] });

    expect(urls).toEqual([`https://server.com/${HASH}.png`]);
  });

  it("should return empty array when no servers available", async () => {
    const uri = `blossom:${HASH}.png`;
    const urls = await getBlobUrls(uri);

    expect(urls).toEqual([]);
  });

  it("should accept a pre-parsed BlossomURI object", async () => {
    const urls = await getBlobUrls({
      sha256: HASH,
      ext: "png",
      servers: ["https://server.com"],
      authors: [],
    });

    expect(urls).toEqual([`https://server.com/${HASH}.png`]);
  });

  it("should normalize bare domain hints to https", async () => {
    const uri = `blossom:${HASH}.png?xs=cdn.example.com`;
    const urls = await getBlobUrls(uri);

    expect(urls).toEqual([`https://cdn.example.com/${HASH}.png`]);
  });

  it("should include file extension in URLs", async () => {
    const uri = `blossom:${HASH}.mp4?xs=https://server.com`;
    const urls = await getBlobUrls(uri);

    expect(urls).toEqual([`https://server.com/${HASH}.mp4`]);
  });
});
