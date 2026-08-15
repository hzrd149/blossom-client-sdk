export function mergeHeaders(base: HeadersInit, extra: HeadersInit): Headers {
  const headers = new Headers(base);
  new Headers(extra).forEach((value, name) => headers.set(name, value));
  return headers;
}
