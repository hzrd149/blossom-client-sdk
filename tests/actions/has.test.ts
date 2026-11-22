import { expect, it } from "vitest";
import { hasBlob } from "../../src/actions/has.js";
import HTTPError from "../../src/error.js";
import fetchMock from "../fetch.js";

it.each([200, 204])("confirms existence on HTTP %i", async (status) => {
  fetchMock.mockResponseOnce(null, { status });
  await expect(hasBlob("https://example.com", "a".repeat(64))).resolves.toBe(true);
});

it("returns false for a missing blob", async () => {
  fetchMock.mockResponseOnce("", { status: 404 });
  await expect(hasBlob("https://example.com", "a".repeat(64))).resolves.toBe(false);
});

it.each([401, 403, 429, 500, 503])("does not mistake HTTP %i for existence", async (status) => {
  fetchMock.mockResponseOnce("", { status, headers: { "X-Reason": "Cannot check existence" } });
  const error = await hasBlob("https://example.com", "a".repeat(64)).catch((error) => error);
  expect(error).toBeInstanceOf(HTTPError);
  expect(error).toMatchObject({ status, message: "Cannot check existence" });
});
