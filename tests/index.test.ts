import { expect, it } from "vitest";

import * as library from "../src/index";

it("should export expected methods", () => {
  expect(Object.keys(library).sort()).toMatchInlineSnapshot(`
    [
      "AUTH_EVENT_KIND",
      "Actions",
      "BlobHashSymbol",
      "TimeoutError",
      "USER_BLOSSOM_SERVER_LIST_KIND",
      "areServersEqual",
      "blossomURIFromURL",
      "blossomURIToURL",
      "buildBlossomURI",
      "computeBlobSha256",
      "createAuthEvent",
      "createDeleteAuth",
      "createDownloadAuth",
      "createListAuth",
      "createMirrorAuth",
      "createUploadAuth",
      "doesAuthMatchRequest",
      "doseAuthMatchBlob",
      "doseAuthMatchUpload",
      "encodeAuthorizationHeader",
      "fetchWithTimeout",
      "getAuthExpiration",
      "getAuthTagValues",
      "getBlobSha256",
      "getBlobSize",
      "getBlobType",
      "getHashFromURL",
      "getPaymentRequestFromHeaders",
      "getReusableAuthEvent",
      "getServerHostname",
      "getServersFromServerListEvent",
      "handleBrokenImages",
      "handleImageFallbacks",
      "isAuthExpired",
      "isSha256",
      "normalizeServerTag",
      "now",
      "oneHour",
      "parseBlossomURI",
      "storeAuthEvent",
      "wrapSignalWithTimeout",
    ]
  `);
});
