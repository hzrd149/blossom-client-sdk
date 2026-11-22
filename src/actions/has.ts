import { ServerType } from "../types.js";
import { fetchWithTimeout } from "../helpers/index.js";
import HTTPError from "../error.js";

export type HasBlobOptions = {
  /** AbortSignal to cancel the action */
  signal?: AbortSignal;
  /** Request timeout */
  timeout?: number;
};

/** Returns false for a missing blob (404), true on success, and throws on other HTTP errors. */
export async function hasBlob<S extends ServerType>(server: S, hash: string, opts?: HasBlobOptions): Promise<boolean> {
  const res = await fetchWithTimeout(new URL("/" + hash, server), {
    method: "HEAD",
    signal: opts?.signal,
    timeout: opts?.timeout,
  });
  if (res.status === 404) return false;
  await HTTPError.handleErrorResponse(res);
  return true;
}
