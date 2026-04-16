import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { handleMediaFallbacks, handleBrokenMedia, createSourceElements } from "../src/media";

const HASH = "b1674191a88ec5cdd733e4240a81803105dc412d6c6708d53ab94fc248f4f553";

describe.runIf(typeof document !== "undefined")("handleMediaFallbacks", () => {
  let getServers: any;

  beforeEach(() => {
    getServers = vi.fn().mockResolvedValue(["https://server2.com", "https://server3.com", "https://server4.com"]);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("should handle fallbacks for img elements", async () => {
    const image = document.createElement("img");
    image.src = `https://server1.com/${HASH}.jpg`;
    image.dataset.pubkey = "test-pubkey";
    document.body.appendChild(image);

    const removeListener = handleMediaFallbacks(image, getServers);

    image.dispatchEvent(new Event("error"));

    await vi.waitFor(() => {
      expect(image.src).toBe(`https://server3.com/${HASH}.jpg`);
    });

    removeListener();
    image.remove();
  });

  it("should handle fallbacks for video elements", async () => {
    const video = document.createElement("video");
    video.src = `https://server1.com/${HASH}.mp4`;
    video.dataset.pubkey = "test-pubkey";
    document.body.appendChild(video);

    const removeListener = handleMediaFallbacks(video, getServers);

    video.dispatchEvent(new Event("error"));

    await vi.waitFor(() => {
      expect(video.src).toBe(`https://server3.com/${HASH}.mp4`);
    });

    removeListener();
    video.remove();
  });

  it("should handle fallbacks for audio elements", async () => {
    const audio = document.createElement("audio");
    audio.src = `https://server1.com/${HASH}.mp3`;
    audio.dataset.pubkey = "test-pubkey";
    document.body.appendChild(audio);

    const removeListener = handleMediaFallbacks(audio, getServers);

    audio.dispatchEvent(new Event("error"));

    await vi.waitFor(() => {
      expect(audio.src).toBe(`https://server3.com/${HASH}.mp3`);
    });

    removeListener();
    audio.remove();
  });

  it("should try multiple servers when errors continue", async () => {
    const video = document.createElement("video");
    video.src = `https://server1.com/${HASH}.mp4`;
    video.dataset.pubkey = "test-pubkey";
    document.body.appendChild(video);

    const removeListener = handleMediaFallbacks(video, getServers);

    video.dispatchEvent(new Event("error"));
    await vi.waitFor(() => {
      expect(video.src).toBe(`https://server3.com/${HASH}.mp4`);
    });

    video.dispatchEvent(new Event("error"));
    await vi.waitFor(() => {
      expect(video.src).toBe(`https://server4.com/${HASH}.mp4`);
    });

    removeListener();
    video.remove();
  });

  it("should use overridePubkey when provided", async () => {
    const image = document.createElement("img");
    image.src = `https://server1.com/${HASH}.jpg`;
    document.body.appendChild(image);

    const removeListener = handleMediaFallbacks(image, getServers, "override-pubkey");

    image.dispatchEvent(new Event("error"));

    await vi.waitFor(() => {
      expect(image.src).toBe(`https://server3.com/${HASH}.jpg`);
    });

    expect(getServers).toHaveBeenCalledWith("override-pubkey");

    removeListener();
    image.remove();
  });

  it("should look for pubkey in parent elements", async () => {
    const parent = document.createElement("div");
    parent.dataset.pubkey = "parent-pubkey";
    const video = document.createElement("video");
    video.src = `https://server1.com/${HASH}.mp4`;
    parent.appendChild(video);
    document.body.appendChild(parent);

    const removeListener = handleMediaFallbacks(video, getServers);

    video.dispatchEvent(new Event("error"));

    await vi.waitFor(() => {
      expect(video.src).toBe(`https://server3.com/${HASH}.mp4`);
    });

    expect(getServers).toHaveBeenCalledWith("parent-pubkey");

    removeListener();
    parent.remove();
  });
  it("should resolve blossom: URI on first error and set first server URL", async () => {
    const image = document.createElement("img");
    image.setAttribute("src", `blossom:${HASH}.png?xs=https://server1.com&xs=https://server2.com`);
    document.body.appendChild(image);

    const removeListener = handleMediaFallbacks(image, getServers);

    // Browser can't load blossom: protocol, fires error
    image.dispatchEvent(new Event("error"));

    await vi.waitFor(() => {
      expect(image.src).toBe(`https://server1.com/${HASH}.png`);
    });

    removeListener();
    image.remove();
  });

  it("should cycle through blossom URI server hints on repeated errors", async () => {
    const image = document.createElement("img");
    image.setAttribute("src", `blossom:${HASH}.png?xs=https://server1.com&xs=https://server2.com`);
    document.body.appendChild(image);

    const removeListener = handleMediaFallbacks(image, getServers);

    // First error resolves blossom URI, sets first server
    image.dispatchEvent(new Event("error"));
    await vi.waitFor(() => {
      expect(image.src).toBe(`https://server1.com/${HASH}.png`);
    });

    // Second error tries next server
    image.dispatchEvent(new Event("error"));
    await vi.waitFor(() => {
      expect(image.src).toBe(`https://server2.com/${HASH}.png`);
    });

    removeListener();
    image.remove();
  });

  it("should resolve blossom URI author hints via getServers", async () => {
    const PUBKEY = "266815e0c9210dfa324c6cba3573b14bee49da4209a9456f9484e5106cd408a5";
    const image = document.createElement("img");
    image.setAttribute("src", `blossom:${HASH}.png?as=${PUBKEY}`);
    document.body.appendChild(image);

    const removeListener = handleMediaFallbacks(image, getServers);

    image.dispatchEvent(new Event("error"));

    await vi.waitFor(() => {
      expect(image.src).toBe(`https://server2.com/${HASH}.png`);
    });

    expect(getServers).toHaveBeenCalledWith(PUBKEY);

    removeListener();
    image.remove();
  });

  it("should work with blossom: URIs on video elements", async () => {
    const video = document.createElement("video");
    video.setAttribute("src", `blossom:${HASH}.mp4?xs=https://server1.com`);
    document.body.appendChild(video);

    const removeListener = handleMediaFallbacks(video, getServers);

    video.dispatchEvent(new Event("error"));

    await vi.waitFor(() => {
      expect(video.src).toBe(`https://server1.com/${HASH}.mp4`);
    });

    removeListener();
    video.remove();
  });

  it("should work with blossom: URIs on audio elements", async () => {
    const audio = document.createElement("audio");
    audio.setAttribute("src", `blossom:${HASH}.mp3?xs=https://server1.com`);
    document.body.appendChild(audio);

    const removeListener = handleMediaFallbacks(audio, getServers);

    audio.dispatchEvent(new Event("error"));

    await vi.waitFor(() => {
      expect(audio.src).toBe(`https://server1.com/${HASH}.mp3`);
    });

    removeListener();
    audio.remove();
  });
});

describe.runIf(typeof document !== "undefined")("handleBrokenMedia", () => {
  let root: HTMLElement;
  let getServers: any;
  let cleanup: () => void;

  beforeEach(() => {
    root = document.createElement("div");
    document.body.appendChild(root);
    getServers = vi.fn().mockResolvedValue(["https://server2.com", "https://server3.com"]);
  });

  afterEach(() => {
    if (cleanup) cleanup();
    root.remove();
    vi.clearAllMocks();
  });

  it("should handle existing images in the root element", async () => {
    const image = document.createElement("img");
    image.src = `https://server1.com/${HASH}.jpg`;
    image.dataset.pubkey = "test-pubkey";
    root.appendChild(image);

    cleanup = handleBrokenMedia(root, getServers);

    image.dispatchEvent(new Event("error"));

    await vi.waitFor(() => {
      expect(image.src).toBe(`https://server3.com/${HASH}.jpg`);
    });
  });

  it("should handle existing video elements", async () => {
    const video = document.createElement("video");
    video.src = `https://server1.com/${HASH}.mp4`;
    video.dataset.pubkey = "test-pubkey";
    root.appendChild(video);

    cleanup = handleBrokenMedia(root, getServers);

    video.dispatchEvent(new Event("error"));

    await vi.waitFor(() => {
      expect(video.src).toBe(`https://server3.com/${HASH}.mp4`);
    });
  });

  it("should handle existing audio elements", async () => {
    const audio = document.createElement("audio");
    audio.src = `https://server1.com/${HASH}.mp3`;
    audio.dataset.pubkey = "test-pubkey";
    root.appendChild(audio);

    cleanup = handleBrokenMedia(root, getServers);

    audio.dispatchEvent(new Event("error"));

    await vi.waitFor(() => {
      expect(audio.src).toBe(`https://server3.com/${HASH}.mp3`);
    });
  });

  it("should handle dynamically added video elements", async () => {
    cleanup = handleBrokenMedia(root, getServers);

    const video = document.createElement("video");
    video.src = `https://server1.com/${HASH}.mp4`;
    video.dataset.pubkey = "test-pubkey";
    root.appendChild(video);

    await new Promise((resolve) => setTimeout(resolve, 1));

    video.dispatchEvent(new Event("error"));

    await vi.waitFor(() => {
      expect(video.src).toBe(`https://server3.com/${HASH}.mp4`);
    });
  });

  it("should handle blossom: URIs in dynamically added elements", async () => {
    cleanup = handleBrokenMedia(root, getServers);

    const image = document.createElement("img");
    image.setAttribute("src", `blossom:${HASH}.png?xs=https://server1.com&xs=https://server2.com`);
    root.appendChild(image);

    // In a real browser, the blossom: protocol triggers an automatic error event.
    // The handler resolves the URI and sets the first xs server URL.
    // We may need to dispatch manually in non-browser envs.
    await new Promise((resolve) => setTimeout(resolve, 1));
    image.dispatchEvent(new Event("error"));

    await vi.waitFor(() => {
      // Should resolve to one of the xs server hints
      expect(image.src).toMatch(new RegExp(`https://server[12]\\.com/${HASH}\\.png`));
    });
  });

  it("should clean up listeners when elements are removed", async () => {
    cleanup = handleBrokenMedia(root, getServers);

    const video = document.createElement("video");
    video.src = `https://server1.com/${HASH}.mp4`;
    video.dataset.pubkey = "test-pubkey";
    root.appendChild(video);

    root.removeChild(video);
    root.appendChild(video);

    await new Promise((resolve) => setTimeout(resolve, 1));

    video.dispatchEvent(new Event("error"));

    await vi.waitFor(() => {
      expect(video.src).toBe(`https://server3.com/${HASH}.mp4`);
    });

    expect(getServers).toHaveBeenCalledTimes(1);
  });

  it("should remove all listeners and stop observing when cleanup is called", async () => {
    cleanup = handleBrokenMedia(root, getServers);

    // Add an existing image
    const image = document.createElement("img");
    image.src = `https://server1.com/${HASH}.jpg`;
    image.dataset.pubkey = "test-pubkey";
    root.appendChild(image);

    // Call cleanup
    cleanup();

    // Add another image after cleanup
    const image2 = document.createElement("img");
    image2.src = `https://server1.com/${HASH}.jpg`;
    image2.dataset.pubkey = "test-pubkey";
    root.appendChild(image2);

    // Trigger errors on both images
    image.dispatchEvent(new Event("error"));
    image2.dispatchEvent(new Event("error"));

    // Wait to ensure async operations would have completed
    await new Promise((resolve) => setTimeout(resolve, 50));

    // getServers should not have been called — all listeners were removed
    expect(getServers).not.toHaveBeenCalled();
  });
});

describe.runIf(typeof document !== "undefined")("createSourceElements", () => {
  it("should create source elements from URLs", () => {
    const urls = ["https://server1.com/hash.mp4", "https://server2.com/hash.mp4"];
    const sources = createSourceElements(urls);

    expect(sources).toHaveLength(2);
    expect(sources[0]).toBeInstanceOf(HTMLSourceElement);
    expect(sources[0].src).toBe("https://server1.com/hash.mp4");
    expect(sources[1].src).toBe("https://server2.com/hash.mp4");
  });

  it("should set MIME type when provided", () => {
    const urls = ["https://server1.com/hash.mp4"];
    const sources = createSourceElements(urls, "video/mp4");

    expect(sources[0].type).toBe("video/mp4");
  });

  it("should not set type when not provided", () => {
    const urls = ["https://server1.com/hash.mp4"];
    const sources = createSourceElements(urls);

    expect(sources[0].type).toBe("");
  });

  it("should handle URL objects", () => {
    const urls = [new URL("https://server1.com/hash.mp4")];
    const sources = createSourceElements(urls);

    expect(sources[0].src).toBe("https://server1.com/hash.mp4");
  });

  it("should return empty array for empty input", () => {
    const sources = createSourceElements([]);
    expect(sources).toEqual([]);
  });
});
