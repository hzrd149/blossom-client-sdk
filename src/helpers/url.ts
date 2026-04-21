/** Normalizes a server reference to a lowercase hostname */
export function getServerHostname(server: string | URL) {
  if (server instanceof URL) return server.hostname.toLowerCase();

  if (URL.canParse(server)) return new URL(server).hostname.toLowerCase();

  return server.toLowerCase();
}

/** Check if two servers are the same */
export function areServersEqual(a: string | URL, b: string | URL) {
  return getServerHostname(a) === getServerHostname(b);
}

/** returns the last sha256 in a URL */
export function getHashFromURL(url: string | URL) {
  if (typeof url === "string") url = new URL(url);

  const hashes = Array.from(url.pathname.matchAll(/[0-9a-f]{64}/gi));
  if (hashes.length > 0) return hashes[hashes.length - 1][0];

  return null;
}
