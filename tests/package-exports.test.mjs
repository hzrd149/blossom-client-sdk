// Run after pnpm build: node --test tests/package-exports.test.mjs
import assert from "node:assert/strict";
import { access } from "node:fs/promises";
import { test } from "node:test";

test("README named SDK imports exist in the published entrypoints", async () => {
  const { readFile } = await import("node:fs/promises");
  const readme = await readFile(new URL("../README.md", import.meta.url), "utf8");
  const imports = [...readme.matchAll(/import\s*\{([^}]+)\}\s*from\s*"(blossom-client-sdk[^"]*)"/g)];
  assert.ok(imports.length > 0);
  for (const [, names, specifier] of imports) {
    const exports = await import(specifier);
    for (const name of names.split(",").map((name) => name.trim())) {
      assert.ok(name in exports, `${specifier} must export ${name}`);
    }
  }
});

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
