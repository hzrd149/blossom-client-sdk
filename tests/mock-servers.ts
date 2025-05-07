import { Mock, vi } from "vitest";
import { getBlobSha256 } from "../src/helpers";
import { BlobDescriptor } from "../src/types";
import { ResponseLike } from "vitest-fetch-mock";
import { PaymentRequest } from "@cashu/cashu-ts";

export const uploadBlob = new Blob(["test content"], { type: "text/plain" });
export const uploadHash = await getBlobSha256(uploadBlob);

export const modifiedBlob = new Blob(["test content modified"], { type: "text/plain" });
export const modifiedHash = await getBlobSha256(modifiedBlob);

export const expectNoErrors = (server, sha256, blob, err) => {
  throw err;
};

const createMockResponse = (server: string, modify = false): BlobDescriptor => ({
  uploaded: Date.now(),
  sha256: modify ? modifiedHash : uploadHash,
  size: modify ? modifiedBlob.size : uploadBlob.size,
  type: modify ? modifiedBlob.type : uploadBlob.type,
  url: `${server}/${modify ? modifiedHash : uploadHash}`,
});

export class MockServer {
  requests: Request[] = [];
  endpoints: { pathname: string; method: Request["method"]; headers: Record<string, string>; body: any }[] = [];

  upload: Mock<(req: Request) => ResponseLike | Promise<ResponseLike>>;
  mirror: Mock<(req: Request) => ResponseLike | Promise<ResponseLike>>;
  media: Mock<(req: Request) => ResponseLike | Promise<ResponseLike>>;

  constructor(public url: string) {
    this.upload = vi.fn().mockReturnValue({
      status: 200,
      body: JSON.stringify(createMockResponse(this.url)),
    });

    this.mirror = vi.fn().mockReturnValue({
      status: 200,
      body: JSON.stringify(createMockResponse(this.url)),
    });

    this.media = vi.fn().mockReturnValue({
      status: 200,
      body: JSON.stringify(createMockResponse(this.url, true)),
    });
  }

  async handleRequest(req: Request): Promise<ResponseLike> {
    if (!req.url.startsWith(this.url)) return;
    this.requests.push(req);
    const pathname = new URL(req.url).pathname;

    this.endpoints.push({
      pathname,
      method: req.method,
      headers: Object.fromEntries(req.headers.entries()),
      body: req.headers.get("Content-Type") === "application/json" ? await req.json() : await req.text(),
    });

    switch (pathname) {
      case "/upload":
        return this.upload(req);
      case "/mirror":
        return this.mirror(req);
      case "/media":
        return this.media(req);
    }
  }

  toString() {
    return Reflect.getPrototypeOf(this)?.constructor?.name ?? "MockServer";
  }
}

/** A server that does not support media uploads */
export class MockServerNoMedia extends MockServer {
  constructor(url: string) {
    super(url);

    this.media.mockReturnValue({
      status: 404,
      body: "unknown endpoint",
    });
  }
}

/** A server that requires an Authorization header to be sent */
export class MockServerRequireAuth extends MockServer {
  constructor(url: string) {
    super(url);
    this.upload.mockImplementation((req) => {
      if (!req.headers.has("Authorization")) return { status: 401 };
      else
        return {
          status: 200,
          body: JSON.stringify(createMockResponse(this.url)),
        };
    });
    this.mirror.mockImplementation((req) => {
      if (!req.headers.has("Authorization")) return { status: 401 };
      else
        return {
          status: 200,
          body: JSON.stringify(createMockResponse(this.url)),
        };
    });
    this.media.mockImplementation((req) => {
      if (!req.headers.has("Authorization")) return { status: 401 };
      else
        return {
          status: 200,
          body: JSON.stringify(createMockResponse(this.url)),
        };
    });
  }
}

/** A server that requires a X-Cashu header to be sent */
export class MockServerRequirePayment extends MockServer {
  constructor(url: string) {
    super(url);
    const paymentRequest = new PaymentRequest([], "test", 1, "sats", ["cashu:test"], "test", true);

    this.upload.mockImplementation((req) => {
      if (!req.headers.has("X-Cashu"))
        return { status: 402, headers: { "X-Cashu": paymentRequest.toEncodedRequest() } };
      else
        return {
          status: 200,
          body: JSON.stringify(createMockResponse(this.url)),
        };
    });
    this.mirror.mockImplementation((req) => {
      if (!req.headers.has("X-Cashu"))
        return { status: 402, headers: { "X-Cashu": paymentRequest.toEncodedRequest() } };
      else
        return {
          status: 200,
          body: JSON.stringify(createMockResponse(this.url)),
        };
    });
    this.media.mockImplementation((req) => {
      if (!req.headers.has("X-Cashu"))
        return { status: 402, headers: { "X-Cashu": paymentRequest.toEncodedRequest() } };
      else
        return {
          status: 200,
          body: JSON.stringify(createMockResponse(this.url)),
        };
    });
  }
}

/** A server that is unreachable */
export class MockOfflineServer extends MockServer {
  constructor(url: string) {
    super(url);

    this.upload.mockImplementation(() => {
      throw new Error("Server is offline");
    });
    this.mirror.mockImplementation(() => {
      throw new Error("Server is offline");
    });
    this.media.mockImplementation(() => {
      throw new Error("Server is offline");
    });
  }
}

/** A server that only returns 500 server errors */
export class MockBrokenServer extends MockServer {
  constructor(url: string) {
    super(url);

    this.upload.mockReturnValue({ status: 500 });
    this.mirror.mockReturnValue({ status: 500 });
    this.media.mockReturnValue({ status: 500 });
  }
}

/** A server that responds with 401 no mater what */
export class MockUnauthorizedServer extends MockServer {
  constructor(url: string) {
    super(url);

    this.upload.mockReturnValue({ status: 401 });
    this.mirror.mockReturnValue({ status: 401 });
    this.media.mockReturnValue({ status: 401 });
  }
}
