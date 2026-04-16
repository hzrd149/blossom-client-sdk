export type RejectionCode = "conflict" | "too_large" | "unsupported_type" | "unprocessable";

const REJECTION_CODES: Record<number, RejectionCode> = {
  409: "conflict",
  413: "too_large",
  415: "unsupported_type",
  422: "unprocessable",
};

export default class HTTPError extends Error {
  response: Response;
  status: number;
  body?: { message: string };
  code?: RejectionCode;

  constructor(response: Response, body: { message: string } | string) {
    super(typeof body === "string" ? body : body.message);
    this.response = response;
    this.status = response.status;
    this.code = REJECTION_CODES[response.status];

    if (typeof body == "object") this.body = body;
  }

  static isRejection(error: unknown): error is HTTPError & { code: RejectionCode } {
    return error instanceof HTTPError && error.code !== undefined;
  }

  static async handleErrorResponse(res: Response) {
    if (!res.ok) {
      try {
        throw new HTTPError(res, res.headers.get("x-reason") || "Something went wrong");
      } catch (e) {
        throw e;
      }
    }
  }
}
