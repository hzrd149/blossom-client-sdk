import { expect, it } from "vitest";

import * as actions from "../../src/actions/index";

it("should export expected methods", () => {
  expect(Object.keys(actions).sort()).toMatchInlineSnapshot(`
    [
      "MediaEndpointMissingError",
      "deleteBlob",
      "downloadBlob",
      "getBlobUrls",
      "hasBlob",
      "iterateBlobs",
      "listBlobs",
      "mirrorBlob",
      "multiServerMediaUpload",
      "multiServerUpload",
      "reportBlobs",
      "resolveBlob",
      "resolveToObjectURL",
      "uploadBlob",
      "uploadMedia",
    ]
  `);
});
