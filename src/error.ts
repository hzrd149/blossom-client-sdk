export default class HTTPError extends Error {
  response: Response;
  status: number;
  body?: { message: string };

  constructor(response: Response, body: { message: string } | string) {
    super(typeof body === "string" ? body : body.message);
    this.response = response;
    this.status = response.status;

    if (typeof body == "object") this.body = body;
  }

  static async handleErrorResponse(res: Response) {
    if (!res.ok) {
      try {
        throw new HTTPError(res, res.headers.get("x-reason") || (await res.json()));
      } catch (e) {
        throw e;
      }
    }
  }
}
