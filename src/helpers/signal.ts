/**
 * Timeout errors and abort signal composition for cancellable requests.
 *
 * @module
 */

export class TimeoutError extends Error {
  name = "TimeoutError";
}

/** Creates and optionally wraps an AbortSignal with a timeout */
export function wrapSignalWithTimeout(
  timeout: number,
  message: string,
  signal: AbortSignal | undefined,
): { cancel: () => void; signal: AbortSignal } {
  const controller = new AbortController();

  const t = setTimeout(() => {
    controller.abort(new TimeoutError(message));
  }, timeout);

  const cancel = () => clearTimeout(t);

  // Native composition preserves existing abort reasons and avoids retaining listeners
  // on a caller's long-lived signal. It also keeps cancellation working after headers arrive.
  return { cancel, signal: signal ? AbortSignal.any([signal, controller.signal]) : controller.signal };
}
