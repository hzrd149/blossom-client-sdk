type NostrEvent = {
  tags: string[][];
};

export const USER_BLOSSOM_SERVER_LIST_KIND = 10063;

export function areServersEqual(a: string | URL, b: string | URL) {
  const hostnameA = a instanceof URL ? a.hostname : new URL(a).hostname;
  const hostnameB = b instanceof URL ? b.hostname : new URL(b).hostname;
  return hostnameA === hostnameB;
}

/** Returns an ordered array of servers found in a server list event (10063) */
export function getServersFromServerListEvent(event: NostrEvent) {
  const servers: URL[] = [];
  for (const tag of event.tags) {
    if (tag[0] === "server" && tag[1]) {
      try {
        const url = new URL(tag[1]);
        url.pathname = "/";

        servers.push(url);
      } catch (e) {}
    }
  }
  return servers;
}
