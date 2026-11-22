// Run after pnpm build: node --test tests/package-exports.test.mjs
import assert from "node:assert/strict";
import { access } from "node:fs/promises";
import { test } from "node:test";

test("published action entrypoints resolve in Node", async () => {
  const actions = await import("blossom-client-sdk/actions");
  const upload = await import("blossom-client-sdk/actions/upload");
  const root = await import("blossom-client-sdk");
  assert.equal(actions.uploadBlob, upload.uploadBlob);
  assert.equal(root.Actions.uploadBlob, actions.uploadBlob);
});

test("every explicit package export has JavaScript and declarations", async () => {
  const { readFile } = await import("node:fs/promises");
  const root = new URL("../", import.meta.url);
  const pkg = JSON.parse(await readFile(new URL("package.json", root), "utf8"));
  for (const [name, entry] of Object.entries(pkg.exports)) {
    if (name.includes("*")) continue;
    await access(new URL(entry.import, root));
    await access(new URL(entry.types, root));
  }
});
