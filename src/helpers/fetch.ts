import { wrapSignalWithTimeout } from "./signal.js";

export type RequestInitWithTimeout = RequestInit & { timeout?: number; timeoutMessage?: string };

/** Make a fetch request with a timeout */
export function fetchWithTimeout(url: string | URL, init?: RequestInitWithTimeout): ReturnType<typeof fetch> {
  if (init?.timeout) {
    const { cancel, signal } = wrapSignalWithTimeout(
      init.timeout,
      init.timeoutMessage ?? "Timeout",
      init.signal ?? undefined,
    );

    return fetch(url, { ...init, signal }).finally(cancel);
  } else return fetch(url, init);
}
