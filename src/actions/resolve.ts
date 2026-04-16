import { BlossomURI, blossomURIFromURL, parseBlossomURI } from "../helpers/blossom-uri.js";
import { fetchWithTimeout } from "../helpers/fetch.js";
import { DownloadOptions } from "./download.js";

type GetServers = (pubkey: string) => Promise<(string | URL)[] | undefined>;

export type ResolveOptions = Omit<DownloadOptions<string | URL>, "onAuth" | "onPayment"> & {
  /** Callback to resolve author pubkeys to ordered server lists (e.g. kind 10063 lookup) */
  getServers?: GetServers;
  /** Additional fallback servers to try after URI hints */
  fallbackServers?: (string | URL)[];
};

function normalizeServer(server: string | URL): string {
  if (server instanceof URL) return server.origin;

  // if it looks like a bare domain, try https first
  if (!server.includes("://")) return `https://${server}`;

  try {
    return new URL(server).origin;
  } catch {
    return `https://${server}`;
  }
}

function parseInput(uri: string | URL | BlossomURI): BlossomURI {
  return uri instanceof URL ? blossomURIFromURL(uri) : typeof uri === "string" ? parseBlossomURI(uri) : uri;
}

function buildBlobPath(sha256: string, ext?: string): string {
  return ext ? `/${sha256}.${ext}` : `/${sha256}`;
}

/** Deduplicating server collector — normalizes and tracks seen servers */
function createServerCollector(path: string) {
  const seen = new Set<string>();
  return {
    get size() {
      return seen.size;
    },
    add(sources: (string | URL)[]): string[] {
      const urls: string[] = [];
      for (const server of sources) {
        const normalized = normalizeServer(server);
        if (!seen.has(normalized)) {
          seen.add(normalized);
          urls.push(normalized + path);
        }
      }
      return urls;
    },
  };
}

export type GetBlobUrlsOptions = {
  /** Callback to resolve author pubkeys to ordered server lists (e.g. kind 10063 lookup) */
  getServers?: GetServers;
  /** Additional fallback servers to try after URI hints */
  fallbackServers?: (string | URL)[];
};

/**
 * Returns an ordered list of URLs for a blob without fetching anything.
 * Resolves servers from xs hints, author hints (via getServers callback), and fallback servers.
 *
 * Accepts a blossom URI string, URL, or pre-parsed BlossomURI.
 */
export async function getBlobUrls(
  uri: string | URL | BlossomURI,
  opts?: GetBlobUrlsOptions,
): Promise<string[]> {
  const parsed = parseInput(uri);
  const collector = createServerCollector(buildBlobPath(parsed.sha256, parsed.ext));
  const urls: string[] = [];

  // 1. xs server hints (synchronous)
  urls.push(...collector.add(parsed.servers));

  // 2. author hints (async — requires relay queries)
  if (opts?.getServers) {
    for (const pubkey of parsed.authors) {
      const authorServers = await opts.getServers(pubkey);
      if (authorServers) urls.push(...collector.add(authorServers));
    }
  }

  // 3. fallback servers
  if (opts?.fallbackServers) urls.push(...collector.add(opts.fallbackServers));

  return urls;
}

/** Resolves a blossom URI to a downloaded blob by trying servers from hints sequentially */
export async function resolveBlob(uri: string | URL | BlossomURI, opts?: ResolveOptions): Promise<Response> {
  const parsed = parseInput(uri);
  const collector = createServerCollector(buildBlobPath(parsed.sha256, parsed.ext));

  /** Try GET on each URL, return the first successful response */
  const tryUrls = async (urls: string[]): Promise<Response | undefined> => {
    for (const url of urls) {
      try {
        const res = await fetchWithTimeout(new URL(url), {
          signal: opts?.signal,
          timeout: opts?.timeout,
        });

        if (res.ok) return res;
      } catch {
        // server unreachable or error — try next
        continue;
      }
    }
    return undefined;
  };

  // 1. try xs server hints first (fastest — no async resolution needed)
  const xsUrls = collector.add(parsed.servers);
  if (xsUrls.length > 0) {
    const result = await tryUrls(xsUrls);
    if (result) return result;
  }

  // 2. resolve and try author hints (deferred — requires relay queries)
  if (opts?.getServers) {
    for (const pubkey of parsed.authors) {
      const authorServers = await opts.getServers(pubkey);
      if (authorServers) {
        const urls = collector.add(authorServers);
        if (urls.length > 0) {
          const result = await tryUrls(urls);
          if (result) return result;
        }
      }
    }
  }

  // 3. try fallback servers
  if (opts?.fallbackServers) {
    const urls = collector.add(opts.fallbackServers);
    if (urls.length > 0) {
      const result = await tryUrls(urls);
      if (result) return result;
    }
  }

  if (collector.size === 0) {
    throw new Error("No servers available to resolve blossom URI");
  }

  throw new Error(`Blob ${parsed.sha256} not found on any server`);
}

/** Resolves a blossom URI and returns a blob: object URL that works anywhere a URL string is accepted */
export async function resolveToObjectURL(uri: string | URL | BlossomURI, opts?: ResolveOptions): Promise<string> {
  const response = await resolveBlob(uri, opts);
  const blob = await response.blob();
  return URL.createObjectURL(blob);
}
