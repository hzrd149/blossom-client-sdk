import { expect, it } from "vitest";

import * as library from "../src/index";

it("should export expected methods", () => {
  expect(Object.keys(library).sort()).toMatchInlineSnapshot(`
    [
      "AUTH_EVENT_KIND",
      "Actions",
      "BlobHashSymbol",
      "BlossomClient",
      "TimeoutError",
      "USER_BLOSSOM_SERVER_LIST_KIND",
      "areServersEqual",
      "computeBlobSha256",
      "createAuthEvent",
      "createDeleteAuth",
      "createDownloadAuth",
      "createListAuth",
      "createMirrorAuth",
      "createUploadAuth",
      "doseAuthMatchBlob",
      "doseAuthMatchUpload",
      "encodeAuthorizationHeader",
      "fetchWithTimeout",
      "getBlobSha256",
      "getBlobSize",
      "getBlobType",
      "getHashFromURL",
      "getPaymentRequestFromHeaders",
      "getServersFromServerListEvent",
      "handleBrokenImages",
      "handleImageFallbacks",
      "isSha256",
      "now",
      "oneHour",
      "wrapSignalWithTimeout",
    ]
  `);
});
