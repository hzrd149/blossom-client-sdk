import { describe, expect, it } from "vitest";
import { getServersFromServerListEvent, USER_BLOSSOM_SERVER_LIST_KIND } from "../src/nostr.js";

describe("getServersFromServerListEvent", () => {
  it("should return an empty array when server tags have no URLs", () => {
    const event = { tags: [["server"], ["server", ""]] };
    const servers = getServersFromServerListEvent(event);
    expect(servers).toEqual([]);
  });

  it("should extract valid server URLs from server tags", () => {
    const event = {
      tags: [
        ["server", "https://example.com/path"],
        ["server", "https://test.org:8080/something"],
        ["other", "https://ignored.com"],
      ],
    };
    const servers = getServersFromServerListEvent(event);

    expect(servers).toHaveLength(2);
    expect(servers[0].toString()).toBe("https://example.com/");
    expect(servers[1].toString()).toBe("https://test.org:8080/");
  });

  it("should ignore invalid URLs", () => {
    const event = {
      tags: [
        ["server", "https://valid.com"],
        ["server", "invalid-url"],
        ["server", "http://valid.org"],
      ],
    };
    const servers = getServersFromServerListEvent(event);

    expect(servers).toHaveLength(2);
    expect(servers[0].toString()).toBe("https://valid.com/");
    expect(servers[1].toString()).toBe("http://valid.org/");
  });

  it("should normalize paths to root", () => {
    const event = {
      tags: [
        ["server", "https://example.com/path/to/something"],
        ["server", "https://test.org/api/v1"],
      ],
    };
    const servers = getServersFromServerListEvent(event);

    expect(servers).toHaveLength(2);
    expect(servers[0].toString()).toBe("https://example.com/");
    expect(servers[1].toString()).toBe("https://test.org/");
  });

  it("should verify USER_BLOSSOM_SERVER_LIST_KIND is correctly defined", () => {
    expect(USER_BLOSSOM_SERVER_LIST_KIND).toBe(10063);
  });
});
