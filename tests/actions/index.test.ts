import { expect, it } from "vitest";

import * as actions from "../../src/actions/index";

it("should export expected methods", () => {
  expect(Object.keys(actions)).toMatchInlineSnapshot(`
    [
      "uploadBlob",
      "mirrorBlob",
      "listBlobs",
      "deleteBlob",
      "downloadBlob",
      "multiServerUpload",
      "MediaEndpointMissingError",
      "uploadMedia",
    ]
  `);
});
