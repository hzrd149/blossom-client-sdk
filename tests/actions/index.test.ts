import { expect, it } from "vitest";

import * as actions from "../../src/actions/index";

it("should export expected methods", () => {
  expect(Object.keys(actions).sort()).toMatchInlineSnapshot(`
    [
      "MediaEndpointMissingError",
      "deleteBlob",
      "downloadBlob",
      "hasBlob",
      "iterateBlobs",
      "listBlobs",
      "mirrorBlob",
      "multiServerUpload",
      "resolveBlob",
      "uploadBlob",
      "uploadMedia",
    ]
  `);
});
