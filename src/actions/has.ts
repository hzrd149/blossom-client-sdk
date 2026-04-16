import { ServerType } from "../types.js";
import { fetchWithTimeout } from "../helpers/index.js";

export type HasBlobOptions = {
  /** AbortSignal to cancel the action */
  signal?: AbortSignal;
  /** Request timeout */
  timeout?: number;
};

/** Checks if a blob exists on a server */
export async function hasBlob<S extends ServerType>(server: S, hash: string, opts?: HasBlobOptions): Promise<boolean> {
  const res = await fetchWithTimeout(new URL("/" + hash, server), {
    method: "HEAD",
    signal: opts?.signal,
    timeout: opts?.timeout,
  });
  return res.status !== 404;
}
