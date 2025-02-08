/** Check if two servers are the same */
export function areServersEqual(a: string | URL, b: string | URL) {
  const hostnameA = a instanceof URL ? a.hostname : new URL(a).hostname;
  const hostnameB = b instanceof URL ? b.hostname : new URL(b).hostname;
  return hostnameA === hostnameB;
}

/** returns the last sha256 in a URL */
export function getHashFromURL(url: string | URL) {
  if (typeof url === "string") url = new URL(url);

  const hashes = Array.from(url.pathname.matchAll(/[0-9a-f]{64}/gi));
  if (hashes.length > 0) return hashes[hashes.length - 1][0];

  return null;
}
