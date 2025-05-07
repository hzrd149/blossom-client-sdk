import { getHashFromURL } from "./helpers/url.js";

type GetServersMethod = (pubkey?: string) => Promise<(string | URL)[] | undefined> | undefined;

/**
 * attaches an "error" event listener to a HTMLImageElement element to handle server fallbacks
 * @param image The image element
 * @param getServers A async method to get an ordered list of servers for a pubkey
 * @param overridePubkey An optional pubkey to set the `data-pubkey` attr on the image
 * @returns returns a method to remove the "error" event listener
 */
export function handleImageFallbacks(image: HTMLImageElement, getServers: GetServersMethod, overridePubkey?: string) {
  let tried: string[] = [];
  let servers: URL[] | undefined = undefined;

  const onError = async () => {
    const hash = getHashFromURL(image.src);
    if (!hash) return;

    const url = new URL(image.src);
    const ext = url.pathname.match(/\.\w+$/i);
    tried.push(url.hostname);

    let pubkey = overridePubkey;

    // walk up the tree looking for pubkey
    let el: HTMLElement | null = image;
    while (!pubkey && el.parentElement) {
      if (el.dataset.pubkey) pubkey = el.dataset.pubkey;
      else el = el.parentElement;
    }

    if (!pubkey) {
      console.warn("Failed to find pubkey for broken image", image);
      return;
    }

    if (!servers) servers = (await getServers(pubkey))?.map((s) => (s instanceof URL ? s : new URL(s)));
    if (servers) {
      const server = servers.find((s) => !tried.includes(s.hostname));

      if (server) {
        url.hostname = server.hostname;
        url.pathname = "/" + hash + ext;
        url.protocol = server.protocol;

        image.src = url.toString();
      } else {
        // ran out of servers, stop listening for errors
        image.removeEventListener("error", onError);
      }
    }
  };

  image.addEventListener("error", onError);

  return () => image.removeEventListener("error", onError);
}

/**
 * Watch for any broken <img> elements in the tree and attempt to fix them
 * @param root The root element to observe
 * @param getServers A method used to get a list of servers for a specific pubkey
 * @returns A MutationObserver that is observing the root element
 */
export function handleBrokenImages(root: HTMLElement, getServers: GetServersMethod) {
  const listeners = new WeakMap<HTMLImageElement, () => void>();

  const observer = new MutationObserver((changes) => {
    for (const change of changes) {
      if (change.type === "childList") {
        // Process added nodes and their children for images
        change.addedNodes.forEach((node) => {
          if (!(node instanceof HTMLElement)) return;

          // Find all img elements in the added node and its children
          const children = Array.from(node.querySelectorAll("img[src]"));
          const images = node instanceof HTMLImageElement ? [node, ...children] : children;

          for (const image of images) {
            if (image instanceof HTMLImageElement && !listeners.has(image)) {
              const listener = handleImageFallbacks(image, getServers);
              listeners.set(image, listener);
            }
          }
        });

        // cleanup removed nodes
        change.removedNodes.forEach((node) => {
          if (!(node instanceof HTMLElement)) return;

          // Find all img elements in the removed node and its children
          const children = Array.from(node.querySelectorAll("img[src]"));
          const images = node instanceof HTMLImageElement ? [node, ...children] : children;
          for (const image of images) {
            if (image instanceof HTMLImageElement) {
              const listener = listeners.get(image);
              if (listener) {
                listener();
                listeners.delete(image);
              }
            }
          }
        });
      }
    }
  });

  // start watching root
  observer.observe(root, { subtree: true, childList: true });

  // find all existing images and attach error handler
  const images = root.querySelectorAll("img[src]");
  images.forEach((image) => {
    if (image instanceof HTMLImageElement) {
      const listener = handleImageFallbacks(image, getServers);
      listeners.set(image, listener);
    }
  });

  return observer;
}
