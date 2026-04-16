import HTTPError from "../error.js";
import { fetchWithTimeout } from "../helpers/fetch.js";
import { ServerType, SignedEvent } from "../types.js";

export type ReportOptions<S extends ServerType> = {
  /** AbortSignal to cancel the action */
  signal?: AbortSignal;
  /** Request timeout */
  timeout?: number;
  /** Called when reporting to a server fails */
  onError?: (server: S, error: Error) => void;
};

function isBlobReportEvent(report: SignedEvent) {
  return report.kind === 1984 && report.tags.some((tag) => tag[0] === "x" && !!tag[1]);
}

/** Sends a signed NIP-56 report event to multiple servers */
export async function reportBlobs<S extends ServerType>(
  servers: Iterable<S>,
  report: SignedEvent,
  opts?: ReportOptions<S>,
): Promise<Map<S, boolean>> {
  if (!isBlobReportEvent(report)) throw new Error("Invalid blob report event");

  const results = new Map<S, boolean>();
  const body = JSON.stringify(report);

  for (const server of servers) {
    try {
      const res = await fetchWithTimeout(new URL("/report", server), {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body,
        signal: opts?.signal,
        timeout: opts?.timeout,
      });

      await HTTPError.handleErrorResponse(res);
      results.set(server, true);
    } catch (error) {
      if (
        opts?.signal?.aborted ||
        (error instanceof Error &&
          (error.name === "AbortError" || error.name === "TimeoutError" || error.message === "Timeout"))
      ) {
        throw error;
      }
      if (error instanceof Error) opts?.onError?.(server, error);
    }
  }

  return results;
}
