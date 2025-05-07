import { describe, expect, it, vi } from "vitest";
import HTTPError from "../src/error";

describe("HTTPError", () => {
  describe("handleErrorResponse", () => {
    it("should throw an HTTPError when response is not ok", async () => {
      const mockResponse = {
        ok: false,
        status: 404,
        headers: {
          get: vi.fn().mockReturnValue("Missing auth header"),
        },
      } as unknown as Response;

      await expect(HTTPError.handleErrorResponse(mockResponse)).rejects.toThrow("Missing auth header");
      await expect(HTTPError.handleErrorResponse(mockResponse)).rejects.toBeInstanceOf(HTTPError);
    });

    it("should throw an HTTPError with default message when x-reason header is missing", async () => {
      const mockResponse = {
        ok: false,
        status: 500,
        headers: {
          get: vi.fn().mockReturnValue(null),
        },
      } as unknown as Response;

      await expect(HTTPError.handleErrorResponse(mockResponse)).rejects.toThrow("Something went wrong");
      await expect(HTTPError.handleErrorResponse(mockResponse)).rejects.toBeInstanceOf(HTTPError);
    });

    it("should not throw an error when response is ok", async () => {
      const mockResponse = {
        ok: true,
      } as Response;

      await expect(HTTPError.handleErrorResponse(mockResponse)).resolves.toBeUndefined();
    });

    it("should include status code and response in the error", async () => {
      const mockResponse = {
        ok: false,
        status: 403,
        headers: {
          get: vi.fn().mockReturnValue("Forbidden"),
        },
      } as unknown as Response;

      await expect(HTTPError.handleErrorResponse(mockResponse)).rejects.toThrow();
      await expect(HTTPError.handleErrorResponse(mockResponse)).rejects.toBeInstanceOf(HTTPError);
    });
  });
});
