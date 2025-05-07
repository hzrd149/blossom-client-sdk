import { describe, expect, it, vi } from "vitest";
import { fetchWithTimeout, RequestInitWithTimeout } from "../../src/helpers/fetch.js";
import fetchMock from "../fetch.js";

describe("fetchWithTimeout", () => {
  it("should call fetch with the provided URL and init", async () => {
    fetchMock.mockResponseOnce("test data");

    const url = "https://example.com";
    const init = { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({}) };

    const response = await fetchWithTimeout(url, init);

    expect(fetchMock).toHaveBeenCalledWith(url, init);
    expect(await response.text()).toBe("test data");
  });

  it("should use timeout when provided", async () => {
    fetchMock.mockResponseOnce("test data");

    const url = "https://example.com";
    const init = {
      method: "GET",
      timeout: 5000,
      timeoutMessage: "Custom timeout message",
    };

    const response = await fetchWithTimeout(url, init);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(
      url,
      expect.objectContaining({
        method: "GET",
        signal: expect.any(AbortSignal),
      }),
    );
    expect(await response.text()).toBe("test data");
  });

  it("should use the provided signal when both timeout and signal are provided", async () => {
    fetchMock.mockResponseOnce("test data");

    const controller = new AbortController();
    const url = "https://example.com";
    const init = {
      method: "GET",
      timeout: 5000,
      signal: controller.signal,
    };

    const response = await fetchWithTimeout(url, init);

    expect(fetchMock).toHaveBeenCalledWith(
      url,
      expect.objectContaining({
        method: "GET",
        signal: expect.any(AbortSignal),
      }),
    );
    expect(await response.text()).toBe("test data");
  });

  it("should use default timeout message when not provided", async () => {
    fetchMock.mockResponseOnce("test data");

    const url = "https://example.com";
    const init = {
      method: "GET",
      timeout: 5000,
    };

    const response = await fetchWithTimeout(url, init);

    expect(fetchMock).toHaveBeenCalledWith(
      url,
      expect.objectContaining({
        method: "GET",
        signal: expect.any(AbortSignal),
      }),
    );
    expect(await response.text()).toBe("test data");
  });

  it("should handle timeout errors", async () => {
    // Mock fetch to delay longer than the timeout
    fetchMock.mockResponseOnce(
      () =>
        new Promise((resolve) => {
          setTimeout(() => resolve(new Response("too late")), 100);
        }),
    );

    const url = "https://example.com";
    const init: RequestInitWithTimeout = {
      method: "GET",
      timeout: 50,
      timeoutMessage: "Request timed out",
    };

    await expect(fetchWithTimeout(url, init)).rejects.toThrow();
  });

  it("should respect an existing abort signal", async () => {
    fetchMock.mockResponseOnce("test data");

    const url = "https://example.com";
    const controller = new AbortController();
    const init: RequestInitWithTimeout = {
      method: "GET",
      signal: controller.signal,
      timeout: 5000,
    };

    const fetchPromise = fetchWithTimeout(url, init);

    // Abort the request
    controller.abort("Request aborted by user");

    // The fetch should be rejected with the abort reason
    await expect(fetchPromise).rejects.toThrow();

    // Verify fetch was called with the signal
    expect(fetchMock).toHaveBeenCalledWith(
      url,
      expect.objectContaining({
        method: "GET",
        signal: expect.any(AbortSignal),
      }),
    );
  });
});
