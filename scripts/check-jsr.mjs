import assert from "node:assert/strict";
import { access, readFile, readdir } from "node:fs/promises";

const root = new URL("../", import.meta.url);
const pkg = JSON.parse(await readFile(new URL("package.json", root), "utf8"));
const jsr = JSON.parse(await readFile(new URL("jsr.json", root), "utf8"));

assert.equal(jsr.name, "@hzrd149/blossom-client");
assert.equal(jsr.version, pkg.version, "Update jsr.json and package.json versions together");

const expected = {};
for (const [name, entry] of Object.entries(pkg.exports)) {
  const source = entry.import.replace("./lib/", "./src/").replace(/\.js$/, ".ts");
  if (name.includes("*")) {
    const directory = source.slice(0, source.indexOf("*"));
    for (const file of await readdir(new URL(directory, root))) {
      if (!file.endsWith(".ts")) continue;
      expected[name.replace("*", file.slice(0, -3))] = `${directory}${file}`;
    }
  } else {
    expected[name] = source;
  }
}
assert.deepEqual(jsr.exports, expected, "JSR exports must match every npm entrypoint");
for (const source of Object.values(jsr.exports)) {
  await access(new URL(source, root));
}
console.log("JSR version and exports match package.json");
