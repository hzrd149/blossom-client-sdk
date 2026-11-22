import { describe, expect, it } from "vitest";
import { uploadBlob } from "../../src/actions/upload.js";
import { uploadMedia } from "../../src/actions/media.js";
import HTTPError from "../../src/error.js";
import fetchMock from "../fetch.js";

describe.each([uploadBlob, uploadMedia])("%s preflight rejection", (upload) => {
  it.each([400, 403, 409, 413, 415, 422, 500, 503])("does not send a body after HTTP %i", async (status) => {
    fetchMock.mockResponseOnce("", { status, headers: { "X-Reason": "Rejected before upload" } });

    const error = await upload("https://example.com", new Blob(["data"])).catch((error) => error);

    expect(error).toBeInstanceOf(HTTPError);
    expect(error.status).toBe(status);
    expect(error.message).toBe("Rejected before upload");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.requests()[0].method).toBe("HEAD");
  });
});
