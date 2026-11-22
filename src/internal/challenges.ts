import { mergeHeaders } from "../helpers/headers.js";

/** Handle each challenge at most once, including challenges from a preflight response. */
export async function handleChallenges(
  response: Response,
  headers: HeadersInit,
  request: (headers: HeadersInit) => Promise<Response>,
  handlers: {
    auth: () => Promise<HeadersInit>;
    payment: (headers: Headers) => Promise<HeadersInit>;
    signal?: AbortSignal;
  },
): Promise<Response> {
  const handled = new Set<number>();
  while ((response.status === 401 || response.status === 402) && !handled.has(response.status)) {
    handlers.signal?.throwIfAborted();
    handled.add(response.status);
    const nextHeaders = response.status === 401 ? await handlers.auth() : await handlers.payment(response.headers);
    handlers.signal?.throwIfAborted();
    headers = mergeHeaders(headers, nextHeaders);
    await response.body?.cancel();
    response = await request(headers);
  }
  return response;
}
