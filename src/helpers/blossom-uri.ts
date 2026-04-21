import { isSha256 } from "./blob.js";

export type BlossomURI = {
  /** SHA-256 hash of the blob */
  sha256: string;
  /** File extension (e.g. "png", "pdf") */
  ext: string;
  /** Server hints from xs params */
  servers: string[];
  /** Author pubkey hints from as params */
  authors: string[];
  /** Expected blob size in bytes from sz param */
  size?: number;
};

/** Parses a blossom: URI string into its components */
export function parseBlossomURI(uri: string): BlossomURI {
  if (!uri.startsWith("blossom:")) throw new Error("Invalid blossom URI: missing blossom: scheme");

  const body = uri.slice("blossom:".length);

  // split hash.ext from query params
  const queryIndex = body.indexOf("?");
  const path = queryIndex === -1 ? body : body.slice(0, queryIndex);
  const query = queryIndex === -1 ? "" : body.slice(queryIndex + 1);

  // extract sha256 and extension
  const dotIndex = path.indexOf(".");
  if (dotIndex === -1) throw new Error("Invalid blossom URI: missing file extension");

  const sha256 = path.slice(0, dotIndex);
  const ext = path.slice(dotIndex + 1);

  if (!isSha256(sha256)) throw new Error("Invalid blossom URI: invalid sha256 hash");
  if (!ext) throw new Error("Invalid blossom URI: empty file extension");

  // parse query params
  const params = new URLSearchParams(query);
  const servers = params.getAll("xs");
  const authors = params.getAll("as");

  const szValue = params.get("sz");
  let size: number | undefined;
  if (szValue !== null) {
    size = Number(szValue);
    if (!Number.isFinite(size) || size <= 0 || Math.floor(size) !== size) {
      throw new Error("Invalid blossom URI: sz must be a positive integer");
    }
  }

  return { sha256, ext, servers, authors, size };
}

/** Builds a blossom: URI string from components */
export function buildBlossomURI(options: BlossomURI): string {
  const params = new URLSearchParams();

  for (const server of options.servers) params.append("xs", server);
  for (const author of options.authors) params.append("as", author);
  if (options.size !== undefined) params.append("sz", String(options.size));

  const query = params.toString();
  return `blossom:${options.sha256}.${options.ext}${query ? "?" + query : ""}`;
}

/** Converts a BlossomURI to a native URL object */
export function blossomURIToURL(uri: string | BlossomURI): URL {
  const str = typeof uri === "string" ? uri : buildBlossomURI(uri);
  return new URL(str);
}

/** Parses a blossom: URL object into its components */
export function blossomURIFromURL(url: URL): BlossomURI {
  if (url.protocol !== "blossom:") throw new Error("Invalid blossom URL: expected blossom: protocol");

  const path = url.pathname;
  const dotIndex = path.indexOf(".");
  if (dotIndex === -1) throw new Error("Invalid blossom URL: missing file extension");

  const sha256 = path.slice(0, dotIndex);
  const ext = path.slice(dotIndex + 1);

  if (!isSha256(sha256)) throw new Error("Invalid blossom URL: invalid sha256 hash");
  if (!ext) throw new Error("Invalid blossom URL: empty file extension");

  const servers = url.searchParams.getAll("xs");
  const authors = url.searchParams.getAll("as");

  const szValue = url.searchParams.get("sz");
  let size: number | undefined;
  if (szValue !== null) {
    size = Number(szValue);
    if (!Number.isFinite(size) || size <= 0 || Math.floor(size) !== size) {
      throw new Error("Invalid blossom URL: sz must be a positive integer");
    }
  }

  return { sha256, ext, servers, authors, size };
}
