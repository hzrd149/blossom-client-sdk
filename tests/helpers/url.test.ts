import { describe, expect, it } from "vitest";
import { areServersEqual, getHashFromURL } from "../../src/helpers/url";

describe("getHashFromURL", () => {
  it("should return the hash from standard blossom URLs", () => {
    expect(
      getHashFromURL(
        "https://blossom.example.com/b1674191a88ec5cdd733e4240a81803105dc412d6c6708d53ab94fc248f4f553.pdf",
      ),
    ).toBe("b1674191a88ec5cdd733e4240a81803105dc412d6c6708d53ab94fc248f4f553");
    expect(
      getHashFromURL("https://blossom.example.com/b1674191a88ec5cdd733e4240a81803105dc412d6c6708d53ab94fc248f4f553"),
    ).toBe("b1674191a88ec5cdd733e4240a81803105dc412d6c6708d53ab94fc248f4f553");
    expect(
      getHashFromURL("http://blossom.example.com/b1674191a88ec5cdd733e4240a81803105dc412d6c6708d53ab94fc248f4f553"),
    ).toBe("b1674191a88ec5cdd733e4240a81803105dc412d6c6708d53ab94fc248f4f553");
  });

  it("should return null when the URL is not a blossom URL", () => {
    expect(getHashFromURL("https://example.com")).toBeNull();
    expect(getHashFromURL("https://example.com/b1674191a88ec5cdd733e4240a81803105dc412d6c6708")).toBeNull();
    expect(getHashFromURL("https://example.com/cat.jpg")).toBeNull();
  });

  it("should return last hash in non-standard blossom URLs", () => {
    expect(
      getHashFromURL(
        "https://blossom.example.com/user/uploads/b1674191a88ec5cdd733e4240a81803105dc412d6c6708d53ab94fc248f4f553.pdf",
      ),
    ).toBe("b1674191a88ec5cdd733e4240a81803105dc412d6c6708d53ab94fc248f4f553");
    expect(
      getHashFromURL(
        "https://cdn.example.com/user/ec4425ff5e9446080d2f70440188e3ca5d6da8713db7bdeef73d0ed54d9093f0/media/b1674191a88ec5cdd733e4240a81803105dc412d6c6708d53ab94fc248f4f553.pdf",
      ),
    ).toBe("b1674191a88ec5cdd733e4240a81803105dc412d6c6708d53ab94fc248f4f553");
    expect(
      getHashFromURL(
        "http://download.example.com/downloads/b1674191a88ec5cdd733e4240a81803105dc412d6c6708d53ab94fc248f4f553",
      ),
    ).toBe("b1674191a88ec5cdd733e4240a81803105dc412d6c6708d53ab94fc248f4f553");
    expect(
      getHashFromURL(
        "http://media.example.com/documents/b1/67/b1674191a88ec5cdd733e4240a81803105dc412d6c6708d53ab94fc248f4f553.pdf",
      ),
    ).toBe("b1674191a88ec5cdd733e4240a81803105dc412d6c6708d53ab94fc248f4f553");
  });
});

describe("areServersEqual", () => {
  it("should return true for same hostnames with different protocols", () => {
    expect(areServersEqual("https://example.com", "http://example.com")).toBe(true);
    expect(areServersEqual("https://example.com/path", "http://example.com/different-path")).toBe(true);
  });

  it("should return true for same hostnames with different paths", () => {
    expect(areServersEqual("https://example.com/path1", "https://example.com/path2")).toBe(true);
    expect(areServersEqual("https://example.com/path", "https://example.com")).toBe(true);
  });

  it("should return true for same hostnames with different query parameters", () => {
    expect(areServersEqual("https://example.com?param=1", "https://example.com?param=2")).toBe(true);
    expect(areServersEqual("https://example.com?param=1", "https://example.com")).toBe(true);
  });

  it("should return false for different hostnames", () => {
    expect(areServersEqual("https://example.com", "https://different.com")).toBe(false);
    expect(areServersEqual("https://sub.example.com", "https://example.com")).toBe(false);
    expect(areServersEqual("https://example.org", "https://example.com")).toBe(false);
  });

  it("should work with URL objects", () => {
    expect(areServersEqual(new URL("https://example.com"), new URL("http://example.com"))).toBe(true);
    expect(areServersEqual(new URL("https://example.com"), "http://example.com")).toBe(true);
    expect(areServersEqual("https://example.com", new URL("http://example.com"))).toBe(true);
    expect(areServersEqual(new URL("https://example.com"), new URL("https://different.com"))).toBe(false);
  });
});
