export type StatusHandlers = Record<number, (response: Response) => Promise<Response>>;

/** Makes a fetch request with status code handlers */
export async function fetchWithHandlers(url: URL | string, init: RequestInit, handlers: StatusHandlers) {
  const res = await fetch(url, init);
  if (handlers[res.status]) {
    return await handlers[res.status](res);
  }
  return res;
}
