/**
 * The Blossom server list event kind and extraction of ordered server URLs from Nostr kind 10063 events.
 *
 * @module
 */

export const USER_BLOSSOM_SERVER_LIST_KIND = 10063;

/** Returns an ordered array of servers found in a server list event (10063) */
export function getServersFromServerListEvent(event: { tags: string[][] }): URL[] {
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
