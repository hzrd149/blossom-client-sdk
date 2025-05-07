import { expect, it } from "vitest";

import * as library from "../src/index";

it("should export expected methods", () => {
  expect(Object.keys(library)).toMatchInlineSnapshot(`
    [
      "Actions",
      "AUTH_EVENT_KIND",
      "now",
      "oneHour",
      "encodeAuthorizationHeader",
      "doseAuthMatchUpload",
      "createAuthEvent",
      "createDownloadAuth",
      "createUploadAuth",
      "createMirrorAuth",
      "createListAuth",
      "createDeleteAuth",
      "BlossomClient",
      "isSha256",
      "BlobHashSymbol",
      "getBlobSha256",
      "computeBlobSha256",
      "getBlobSize",
      "getBlobType",
      "getPaymentRequestFromHeaders",
      "fetchWithTimeout",
      "TimeoutError",
      "wrapSignalWithTimeout",
      "areServersEqual",
      "getHashFromURL",
      "handleImageFallbacks",
      "handleBrokenImages",
      "USER_BLOSSOM_SERVER_LIST_KIND",
      "getServersFromServerListEvent",
    ]
  `);
});
