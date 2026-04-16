import { describe, expect, it } from "vitest";
import { parseBlossomURI, buildBlossomURI, blossomURIToURL, blossomURIFromURL } from "../../src/helpers/blossom-uri";

const HASH = "b1674191a88ec5cdd733e4240a81803105dc412d6c6708d53ab94fc248f4f553";
const PUBKEY = "266815e0c9210dfa324c6cba3573b14bee49da4209a9456f9484e5106cd408a5";

describe("parseBlossomURI", () => {
  it("should parse a minimal URI with hash and extension", () => {
    const result = parseBlossomURI(`blossom:${HASH}.png`);
    expect(result.sha256).toBe(HASH);
    expect(result.ext).toBe("png");
    expect(result.servers).toEqual([]);
    expect(result.authors).toEqual([]);
    expect(result.size).toBeUndefined();
  });

  it("should parse server hints (xs params)", () => {
    const result = parseBlossomURI(`blossom:${HASH}.pdf?xs=cdn.example.com&xs=https://cdn.other.com`);
    expect(result.servers).toEqual(["cdn.example.com", "https://cdn.other.com"]);
  });

  it("should parse author hints (as params)", () => {
    const result = parseBlossomURI(`blossom:${HASH}.bin?as=${PUBKEY}`);
    expect(result.authors).toEqual([PUBKEY]);
  });

  it("should parse size hint (sz param)", () => {
    const result = parseBlossomURI(`blossom:${HASH}.bin?sz=1024`);
    expect(result.size).toBe(1024);
  });

  it("should parse all params together", () => {
    const uri = `blossom:${HASH}.jpg?xs=cdn.example.com&as=${PUBKEY}&sz=2048`;
    const result = parseBlossomURI(uri);
    expect(result.sha256).toBe(HASH);
    expect(result.ext).toBe("jpg");
    expect(result.servers).toEqual(["cdn.example.com"]);
    expect(result.authors).toEqual([PUBKEY]);
    expect(result.size).toBe(2048);
  });

  it("should throw on missing blossom: scheme", () => {
    expect(() => parseBlossomURI(`${HASH}.png`)).toThrow("missing blossom: scheme");
  });

  it("should throw on missing extension", () => {
    expect(() => parseBlossomURI(`blossom:${HASH}`)).toThrow("missing file extension");
  });

  it("should throw on invalid sha256", () => {
    expect(() => parseBlossomURI("blossom:abc123.png")).toThrow("invalid sha256");
  });

  it("should throw on invalid sz value", () => {
    expect(() => parseBlossomURI(`blossom:${HASH}.bin?sz=-1`)).toThrow("positive integer");
    expect(() => parseBlossomURI(`blossom:${HASH}.bin?sz=abc`)).toThrow("positive integer");
    expect(() => parseBlossomURI(`blossom:${HASH}.bin?sz=1.5`)).toThrow("positive integer");
  });
});

describe("buildBlossomURI", () => {
  it("should build a minimal URI", () => {
    const uri = buildBlossomURI({ sha256: HASH, ext: "png", servers: [], authors: [] });
    expect(uri).toBe(`blossom:${HASH}.png`);
  });

  it("should include server hints", () => {
    const uri = buildBlossomURI({ sha256: HASH, ext: "pdf", servers: ["cdn.example.com"], authors: [] });
    expect(uri).toBe(`blossom:${HASH}.pdf?xs=cdn.example.com`);
  });

  it("should include author hints", () => {
    const uri = buildBlossomURI({ sha256: HASH, ext: "bin", servers: [], authors: [PUBKEY] });
    expect(uri).toBe(`blossom:${HASH}.bin?as=${PUBKEY}`);
  });

  it("should include size", () => {
    const uri = buildBlossomURI({ sha256: HASH, ext: "bin", servers: [], authors: [], size: 1024 });
    expect(uri).toBe(`blossom:${HASH}.bin?sz=1024`);
  });

  it("should include all params", () => {
    const uri = buildBlossomURI({
      sha256: HASH,
      ext: "jpg",
      servers: ["cdn.example.com", "https://cdn.other.com"],
      authors: [PUBKEY],
      size: 2048,
    });
    expect(uri).toContain(`blossom:${HASH}.jpg?`);
    expect(uri).toContain("xs=cdn.example.com");
    expect(uri).toContain(`xs=${encodeURIComponent("https://cdn.other.com")}`);
    expect(uri).toContain(`as=${PUBKEY}`);
    expect(uri).toContain("sz=2048");
  });
});

describe("round-trip", () => {
  it("should round-trip a minimal URI", () => {
    const uri = `blossom:${HASH}.png`;
    expect(buildBlossomURI(parseBlossomURI(uri))).toBe(uri);
  });

  it("should round-trip with server hints", () => {
    const uri = `blossom:${HASH}.pdf?xs=cdn.example.com`;
    expect(buildBlossomURI(parseBlossomURI(uri))).toBe(uri);
  });

  it("should round-trip with all params", () => {
    const original = { sha256: HASH, ext: "jpg", servers: ["cdn.example.com"], authors: [PUBKEY], size: 2048 };
    const roundTripped = parseBlossomURI(buildBlossomURI(original));
    expect(roundTripped.sha256).toBe(original.sha256);
    expect(roundTripped.ext).toBe(original.ext);
    expect(roundTripped.servers).toEqual(original.servers);
    expect(roundTripped.authors).toEqual(original.authors);
    expect(roundTripped.size).toBe(original.size);
  });
});

describe("blossomURIToURL", () => {
  it("should convert a string URI to a URL object", () => {
    const url = blossomURIToURL(`blossom:${HASH}.png?xs=cdn.example.com&sz=1024`);
    expect(url).toBeInstanceOf(URL);
    expect(url.protocol).toBe("blossom:");
    expect(url.pathname).toBe(`${HASH}.png`);
    expect(url.searchParams.get("xs")).toBe("cdn.example.com");
    expect(url.searchParams.get("sz")).toBe("1024");
  });

  it("should convert a BlossomURI object to a URL object", () => {
    const url = blossomURIToURL({ sha256: HASH, ext: "pdf", servers: ["cdn.example.com"], authors: [PUBKEY], size: 512 });
    expect(url.protocol).toBe("blossom:");
    expect(url.pathname).toBe(`${HASH}.pdf`);
    expect(url.searchParams.get("xs")).toBe("cdn.example.com");
    expect(url.searchParams.get("as")).toBe(PUBKEY);
    expect(url.searchParams.get("sz")).toBe("512");
  });
});

describe("blossomURIFromURL", () => {
  it("should parse a blossom: URL object into BlossomURI", () => {
    const url = new URL(`blossom:${HASH}.png?xs=cdn.example.com&as=${PUBKEY}&sz=2048`);
    const result = blossomURIFromURL(url);
    expect(result.sha256).toBe(HASH);
    expect(result.ext).toBe("png");
    expect(result.servers).toEqual(["cdn.example.com"]);
    expect(result.authors).toEqual([PUBKEY]);
    expect(result.size).toBe(2048);
  });

  it("should parse a minimal blossom: URL", () => {
    const url = new URL(`blossom:${HASH}.bin`);
    const result = blossomURIFromURL(url);
    expect(result.sha256).toBe(HASH);
    expect(result.ext).toBe("bin");
    expect(result.servers).toEqual([]);
    expect(result.authors).toEqual([]);
    expect(result.size).toBeUndefined();
  });

  it("should throw on non-blossom protocol", () => {
    const url = new URL("https://example.com/test.png");
    expect(() => blossomURIFromURL(url)).toThrow("expected blossom: protocol");
  });

  it("should round-trip through URL", () => {
    const original = { sha256: HASH, ext: "jpg", servers: ["cdn.example.com"], authors: [PUBKEY], size: 4096 };
    const url = blossomURIToURL(original);
    const result = blossomURIFromURL(url);
    expect(result.sha256).toBe(original.sha256);
    expect(result.ext).toBe(original.ext);
    expect(result.servers).toEqual(original.servers);
    expect(result.authors).toEqual(original.authors);
    expect(result.size).toBe(original.size);
  });
});
