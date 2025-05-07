import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { handleImageFallbacks, handleBrokenImages } from "../src/image";

describe.runIf(typeof document !== "undefined")("handleImageFallbacks", () => {
  let image: HTMLImageElement;
  let getServers: any;
  let removeListener: () => void;

  beforeEach(() => {
    // Create a new image element for each test
    image = document.createElement("img");
    image.src = "https://server1.com/b1674191a88ec5cdd733e4240a81803105dc412d6c6708d53ab94fc248f4f553.jpg";
    document.body.appendChild(image);

    // Mock the getServers function
    getServers = vi.fn().mockResolvedValue(["https://server2.com", "https://server3.com", "https://server4.com"]);
  });

  afterEach(() => {
    // Clean up after each test
    image.remove();
    if (removeListener) removeListener();
    vi.clearAllMocks();
  });

  it("should change image src when error event is triggered", async () => {
    // Set up pubkey
    image.dataset.pubkey = "test-pubkey";

    // Attach the error handler
    removeListener = handleImageFallbacks(image, getServers);

    // Trigger the error event
    image.dispatchEvent(new Event("error"));

    // Wait for async operations to complete
    await vi.waitFor(() => {
      expect(image.src).toBe(
        "https://server3.com/b1674191a88ec5cdd733e4240a81803105dc412d6c6708d53ab94fc248f4f553.jpg",
      );
    });

    // Verify getServers was called with the correct pubkey
    expect(getServers).toHaveBeenCalledTimes(1);
    expect(getServers).toHaveBeenCalledWith("test-pubkey");
  });

  it("should try multiple servers when errors continue", async () => {
    // Set up pubkey
    image.dataset.pubkey = "test-pubkey";

    // Attach the error handler
    removeListener = handleImageFallbacks(image, getServers);

    // Trigger first error
    image.dispatchEvent(new Event("error"));

    // Wait for first server change
    await vi.waitFor(() => {
      expect(image.src).toBe(
        "https://server3.com/b1674191a88ec5cdd733e4240a81803105dc412d6c6708d53ab94fc248f4f553.jpg",
      );
    });

    // Trigger second error
    image.dispatchEvent(new Event("error"));

    // Wait for second server change
    await vi.waitFor(() => {
      expect(image.src).toBe(
        "https://server4.com/b1674191a88ec5cdd733e4240a81803105dc412d6c6708d53ab94fc248f4f553.jpg",
      );
    });
  });

  it("should use overridePubkey when provided", async () => {
    // Attach the error handler with override pubkey
    removeListener = handleImageFallbacks(image, getServers, "override-pubkey");

    // Trigger the error event
    image.dispatchEvent(new Event("error"));

    // Wait for async operations to complete
    await vi.waitFor(() => {
      expect(image.src).toBe(
        "https://server3.com/b1674191a88ec5cdd733e4240a81803105dc412d6c6708d53ab94fc248f4f553.jpg",
      );
    });

    // Verify getServers was called with the override pubkey
    expect(getServers).toHaveBeenCalledWith("override-pubkey");
  });

  it("should look for pubkey in parent elements", async () => {
    // Create parent with pubkey
    const parent = document.createElement("div");
    parent.dataset.pubkey = "parent-pubkey";
    parent.appendChild(image);
    document.body.appendChild(parent);

    // Attach the error handler
    removeListener = handleImageFallbacks(image, getServers);

    // Trigger the error event
    image.dispatchEvent(new Event("error"));

    // Wait for async operations to complete
    await vi.waitFor(() => {
      expect(image.src).toBe(
        "https://server3.com/b1674191a88ec5cdd733e4240a81803105dc412d6c6708d53ab94fc248f4f553.jpg",
      );
    });

    // Verify getServers was called with the parent's pubkey
    expect(getServers).toHaveBeenCalledWith("parent-pubkey");

    // Clean up
    parent.remove();
  });

  it("should do nothing if no hash is found in URL", async () => {
    // Use a URL without a valid hash
    image.src = "https://server1.com/image.jpg";
    image.dataset.pubkey = "test-pubkey";

    // Attach the error handler
    removeListener = handleImageFallbacks(image, getServers);

    // Original src
    const originalSrc = image.src;

    // Trigger the error event
    image.dispatchEvent(new Event("error"));

    // Wait a bit to ensure async operations would have completed
    await new Promise((resolve) => setTimeout(resolve, 50));

    // Verify src hasn't changed
    expect(image.src).toBe(originalSrc);
    expect(getServers).not.toHaveBeenCalled();
  });

  it("should preserve file extension when changing servers", async () => {
    image.src = "https://server1.com/b1674191a88ec5cdd733e4240a81803105dc412d6c6708d53ab94fc248f4f553.png";
    image.dataset.pubkey = "test-pubkey";

    // Attach the error handler
    removeListener = handleImageFallbacks(image, getServers);

    // Trigger the error event
    image.dispatchEvent(new Event("error"));

    // Wait for async operations to complete
    await vi.waitFor(() => {
      expect(image.src).toBe(
        "https://server3.com/b1674191a88ec5cdd733e4240a81803105dc412d6c6708d53ab94fc248f4f553.png",
      );
    });
  });

  it("should handle non-standard blossom URLs", async () => {
    image.src = "https://server1.com/user/uploads/b1674191a88ec5cdd733e4240a81803105dc412d6c6708d53ab94fc248f4f553.pdf";
    image.dataset.pubkey = "test-pubkey";

    // Attach the error handler
    removeListener = handleImageFallbacks(image, getServers);

    // Trigger the error event
    image.dispatchEvent(new Event("error"));

    // Wait for async operations to complete
    await vi.waitFor(() => {
      expect(image.src).toBe(
        "https://server3.com/b1674191a88ec5cdd733e4240a81803105dc412d6c6708d53ab94fc248f4f553.pdf",
      );
    });
  });
});

describe.runIf(typeof document !== "undefined")("handleBrokenImages", () => {
  let root: HTMLElement;
  let getServers: any;
  let observer: MutationObserver;

  beforeEach(() => {
    // Create a root element for testing
    root = document.createElement("div");
    document.body.appendChild(root);

    // Mock the getServers function
    getServers = vi.fn().mockResolvedValue(["https://server2.com", "https://server3.com"]);
  });

  afterEach(() => {
    // Clean up after each test
    if (observer) observer.disconnect();
    root.remove();
    vi.clearAllMocks();
  });

  it("should handle existing images in the root element", async () => {
    // Add an existing image to the root
    const image = document.createElement("img");
    image.src = "https://server1.com/b1674191a88ec5cdd733e4240a81803105dc412d6c6708d53ab94fc248f4f553.jpg";
    image.dataset.pubkey = "test-pubkey";
    root.appendChild(image);

    // Start observing
    observer = handleBrokenImages(root, getServers);

    // Trigger error on the image
    image.dispatchEvent(new Event("error"));

    // Wait for async operations to complete
    await vi.waitFor(() => {
      expect(image.src).toBe(
        "https://server3.com/b1674191a88ec5cdd733e4240a81803105dc412d6c6708d53ab94fc248f4f553.jpg",
      );
    });

    expect(getServers).toHaveBeenCalledWith("test-pubkey");
  });

  it("should handle new images added to the DOM", async () => {
    // Start observing
    observer = handleBrokenImages(root, getServers);

    // Add a new image
    const image = document.createElement("img");
    image.src = "https://server1.com/b1674191a88ec5cdd733e4240a81803105dc412d6c6708d53ab94fc248f4f553.jpg";
    image.dataset.pubkey = "test-pubkey";
    root.appendChild(image);

    // Wait for next tick
    await new Promise((resolve) => setTimeout(resolve, 1));

    // Trigger error on the image
    image.dispatchEvent(new Event("error"));

    // Wait for async operations to complete
    await vi.waitFor(() => {
      expect(image.src).toBe(
        "https://server3.com/b1674191a88ec5cdd733e4240a81803105dc412d6c6708d53ab94fc248f4f553.jpg",
      );
    });

    expect(getServers).toHaveBeenCalledWith("test-pubkey");
  });

  it("should handle nested images in added elements", async () => {
    // Start observing
    observer = handleBrokenImages(root, getServers);

    // Add a container with a nested image
    const container = document.createElement("div");
    const image = document.createElement("img");
    image.src = "https://server1.com/b1674191a88ec5cdd733e4240a81803105dc412d6c6708d53ab94fc248f4f553.jpg";
    image.dataset.pubkey = "test-pubkey";
    container.appendChild(image);
    root.appendChild(container);

    // Wait for next tick
    await new Promise((resolve) => setTimeout(resolve, 1));

    // Trigger error on the image
    image.dispatchEvent(new Event("error"));

    // Wait for async operations to complete
    await vi.waitFor(() => {
      expect(image.src).toBe(
        "https://server3.com/b1674191a88ec5cdd733e4240a81803105dc412d6c6708d53ab94fc248f4f553.jpg",
      );
    });

    expect(getServers).toHaveBeenCalledWith("test-pubkey");
  });

  it("should clean up listeners when images are removed", async () => {
    // Start observing
    observer = handleBrokenImages(root, getServers);

    // Add an image
    const image = document.createElement("img");
    image.src = "https://server1.com/b1674191a88ec5cdd733e4240a81803105dc412d6c6708d53ab94fc248f4f553.jpg";
    image.dataset.pubkey = "test-pubkey";
    root.appendChild(image);

    // Remove the image
    root.removeChild(image);

    // Add it back
    root.appendChild(image);

    // Wait for next tick
    await new Promise((resolve) => setTimeout(resolve, 1));

    // Trigger error on the image
    image.dispatchEvent(new Event("error"));

    // Wait for async operations to complete
    await vi.waitFor(() => {
      expect(image.src).toBe(
        "https://server3.com/b1674191a88ec5cdd733e4240a81803105dc412d6c6708d53ab94fc248f4f553.jpg",
      );
    });

    // Verify getServers was called only once (for the new instance)
    expect(getServers).toHaveBeenCalledTimes(1);
  });

  it("should return a MutationObserver that can be disconnected", async () => {
    // Start observing
    observer = handleBrokenImages(root, getServers);

    // Add an image
    const image = document.createElement("img");
    image.src = "https://server1.com/b1674191a88ec5cdd733e4240a81803105dc412d6c6708d53ab94fc248f4f553.jpg";
    image.dataset.pubkey = "test-pubkey";
    root.appendChild(image);

    // Disconnect the observer
    observer.disconnect();

    // Add another image
    const image2 = document.createElement("img");
    image2.src = "https://server1.com/b1674191a88ec5cdd733e4240a81803105dc412d6c6708d53ab94fc248f4f553.jpg";
    image2.dataset.pubkey = "test-pubkey";
    root.appendChild(image2);

    // Trigger error on both images
    image.dispatchEvent(new Event("error"));
    image2.dispatchEvent(new Event("error"));

    // Wait a bit to ensure async operations would have completed
    await new Promise((resolve) => setTimeout(resolve, 50));

    // Verify getServers was never called (observer was disconnected)
    expect(getServers).not.toHaveBeenCalled();
  });
});
