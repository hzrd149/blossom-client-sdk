import { getHashFromURL } from "./helpers/url.js";
import { parseBlossomURI } from "./helpers/blossom-uri.js";
import { getBlobUrls } from "./actions/resolve.js";

type MediaElement = HTMLImageElement | HTMLVideoElement | HTMLAudioElement;

type GetServersMethod = (pubkey?: string) => Promise<(string | URL)[] | undefined> | undefined;

/**
 * Attaches an "error" event listener to a media element (img, video, audio) to handle server fallbacks.
 *
 * Supports two modes:
 * - **Blossom URIs**: If the element's `src` is a `blossom:` URI, parses it and resolves server URLs
 *   from xs hints, author hints (via getServers), and builds a fallback chain automatically.
 * - **HTTP URLs**: Extracts the blob hash from the URL, walks the DOM for a `data-pubkey` attribute,
 *   and uses the getServers callback to find alternative servers.
 *
 * @param element The media element (img, video, or audio)
 * @param getServers An async method to get an ordered list of servers for a pubkey
 * @param overridePubkey An optional pubkey to use instead of walking the DOM
 * @returns A method to remove the "error" event listener
 */
export function handleMediaFallbacks(element: MediaElement, getServers: GetServersMethod, overridePubkey?: string) {
  let urls: string[] | undefined;
  let urlIndex = 0;

  /** Resolve a blossom: URI into an ordered list of HTTP URLs */
  const resolveBlossomUri = async (src: string): Promise<string[]> => {
    const parsed = parseBlossomURI(src);
    return getBlobUrls(parsed, {
      getServers: getServers
        ? async (pubkey) => (await getServers(pubkey)) ?? undefined
        : undefined,
    });
  };

  /** Resolve an HTTP blob URL into fallback URLs via pubkey server lookup */
  const resolveHttpUrl = async (): Promise<string[] | undefined> => {
    const hash = getHashFromURL(element.src);
    if (!hash) return undefined;

    const url = new URL(element.src);
    const ext = url.pathname.match(/\.\w+$/i);

    let pubkey = overridePubkey;

    // walk up the tree looking for pubkey
    let el: HTMLElement | null = element;
    while (!pubkey && el.parentElement) {
      if (el.dataset.pubkey) pubkey = el.dataset.pubkey;
      else el = el.parentElement;
    }

    if (!pubkey) {
      console.warn("Failed to find pubkey for broken media element", element);
      return undefined;
    }

    const servers = (await getServers(pubkey))?.map((s) => (s instanceof URL ? s : new URL(s)));
    if (!servers) return undefined;

    return servers
      .filter((s) => s.hostname !== url.hostname)
      .map((s) => {
        const u = new URL(url);
        u.hostname = s.hostname;
        u.protocol = s.protocol;
        u.pathname = "/" + hash + (ext?.[0] ?? "");
        return u.toString();
      });
  };

  const onError = async () => {
    // Already resolved — try the next URL in the list
    if (urls) {
      if (urlIndex < urls.length) {
        element.src = urls[urlIndex++];
      } else {
        element.removeEventListener("error", onError);
      }
      return;
    }

    // First error — resolve URLs based on src type
    const rawSrc = element.getAttribute("src") || "";

    if (rawSrc.startsWith("blossom:")) {
      urls = await resolveBlossomUri(rawSrc);
    } else {
      urls = (await resolveHttpUrl()) ?? [];
    }

    urlIndex = 0;
    if (urls.length > 0) {
      element.src = urls[urlIndex++];
    } else {
      element.removeEventListener("error", onError);
    }
  };

  element.addEventListener("error", onError);

  return () => element.removeEventListener("error", onError);
}

const MEDIA_SELECTOR = "img[src], video[src], audio[src]";

function isMediaElement(node: Node): node is MediaElement {
  return node instanceof HTMLImageElement || node instanceof HTMLVideoElement || node instanceof HTMLAudioElement;
}

/**
 * Watch for any broken media elements (img, video, audio) in the DOM tree and attempt to fix them
 * by trying alternative blossom servers. Supports both regular HTTP blob URLs and blossom: URIs.
 *
 * @param root The root element to observe
 * @param getServers A method used to get a list of servers for a specific pubkey
 * @returns A cleanup function that disconnects the observer and removes all error listeners
 */
export function handleBrokenMedia(root: HTMLElement, getServers: GetServersMethod): () => void {
  const listeners = new Map<MediaElement, () => void>();

  const attachFallback = (element: MediaElement) => {
    if (!listeners.has(element)) {
      const listener = handleMediaFallbacks(element, getServers);
      listeners.set(element, listener);
    }
  };

  const detachFallback = (element: MediaElement) => {
    const listener = listeners.get(element);
    if (listener) {
      listener();
      listeners.delete(element);
    }
  };

  const observer = new MutationObserver((changes) => {
    for (const change of changes) {
      if (change.type === "childList") {
        // Process added nodes and their children for media elements
        change.addedNodes.forEach((node) => {
          if (!(node instanceof HTMLElement)) return;

          const children = Array.from(node.querySelectorAll(MEDIA_SELECTOR));
          const elements = isMediaElement(node) ? [node, ...children] : children;

          for (const element of elements) {
            if (isMediaElement(element)) attachFallback(element);
          }
        });

        // cleanup removed nodes
        change.removedNodes.forEach((node) => {
          if (!(node instanceof HTMLElement)) return;

          const children = Array.from(node.querySelectorAll(MEDIA_SELECTOR));
          const elements = isMediaElement(node) ? [node, ...children] : children;

          for (const element of elements) {
            if (isMediaElement(element)) detachFallback(element);
          }
        });
      }
    }
  });

  // start watching root
  observer.observe(root, { subtree: true, childList: true });

  // find all existing media elements and attach error handler
  root.querySelectorAll(MEDIA_SELECTOR).forEach((element) => {
    if (isMediaElement(element)) attachFallback(element);
  });

  return () => {
    observer.disconnect();
    for (const element of listeners.keys()) {
      detachFallback(element);
    }
  };
}

/**
 * Creates an array of HTMLSourceElement elements from a list of URLs.
 * Useful for providing native browser fallback for video and audio elements,
 * where the browser automatically tries the next <source> when one fails.
 *
 * @param urls Ordered list of blob URLs to try
 * @param type Optional MIME type to set on each source element (e.g. "video/mp4", "audio/ogg")
 * @returns Array of HTMLSourceElement elements
 */
export function createSourceElements(urls: (string | URL)[], type?: string): HTMLSourceElement[] {
  return urls.map((url) => {
    const source = document.createElement("source");
    source.src = url.toString();
    if (type) source.type = type;
    return source;
  });
}
