export class TimeoutError extends Error {}

/** Creates and optionally wraps an AbortSignal with a timeout */
export function wrapSignalWithTimeout(
  timeout: number,
  message: string,
  signal: AbortSignal | undefined,
): { cancel: () => void; signal: AbortSignal } {
  const controller = new AbortController();

  if (signal) signal.addEventListener("abort", (err) => controller.abort(err));

  const t = setTimeout(() => {
    controller.abort(new TimeoutError(message));
  }, timeout);

  const cancel = () => clearTimeout(t);

  return { cancel, signal: controller.signal };
}
