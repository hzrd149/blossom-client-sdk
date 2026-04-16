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

/** Resolves a blossom URI to a downloaded blob by trying servers from hints sequentially */
export async function resolveBlob(uri: string | URL | BlossomURI, opts?: ResolveOptions): Promise<Response> {
  const parsed =
    uri instanceof URL ? blossomURIFromURL(uri) : typeof uri === "string" ? parseBlossomURI(uri) : uri;

  const seen = new Set<string>();

  const addServers = (sources: (string | URL)[]) => {
    const added: string[] = [];
    for (const server of sources) {
      const normalized = normalizeServer(server);
      if (!seen.has(normalized)) {
        seen.add(normalized);
        added.push(normalized);
      }
    }
    return added;
  };

  /** Try GET on each server, return the first successful response */
  const tryServers = async (servers: string[]): Promise<Response | undefined> => {
    for (const server of servers) {
      try {
        const res = await fetchWithTimeout(new URL("/" + parsed.sha256, server), {
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
  const xsServers = addServers(parsed.servers);
  if (xsServers.length > 0) {
    const result = await tryServers(xsServers);
    if (result) return result;
  }

  // 2. resolve and try author hints (deferred — requires relay queries)
  if (opts?.getServers) {
    for (const pubkey of parsed.authors) {
      const authorServers = await opts.getServers(pubkey);
      if (authorServers) {
        const servers = addServers(authorServers);
        if (servers.length > 0) {
          const result = await tryServers(servers);
          if (result) return result;
        }
      }
    }
  }

  // 3. try fallback servers
  if (opts?.fallbackServers) {
    const servers = addServers(opts.fallbackServers);
    if (servers.length > 0) {
      const result = await tryServers(servers);
      if (result) return result;
    }
  }

  if (seen.size === 0) {
    throw new Error("No servers available to resolve blossom URI");
  }

  throw new Error(`Blob ${parsed.sha256} not found on any server`);
}
