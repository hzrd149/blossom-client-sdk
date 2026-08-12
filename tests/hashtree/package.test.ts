import { execFileSync } from "node:child_process";
import { access, mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const projectRoot = resolve(fileURLToPath(new URL("../..", import.meta.url)));
const expectedTargets = [
  "lib/hashtree/index.js",
  "lib/hashtree/index.d.ts",
  "lib/hashtree/types.js",
  "lib/hashtree/types.d.ts",
  "lib/hashtree/errors.js",
  "lib/hashtree/errors.d.ts",
  "lib/hashtree/chk.js",
  "lib/hashtree/chk.d.ts",
  "lib/hashtree/blossom-reference.js",
  "lib/hashtree/blossom-reference.d.ts",
];

type PackResult = {
  readonly filename: string;
};

describe("packed Hashtree contract", () => {
  it("resolves every supported entry while keeping the root isolated", async () => {
    const directory = await mkdtemp(join(projectRoot, ".tmp-hashtree-package-"));
    const packDestination = join(directory, "tarball");
    const extractionDestination = join(directory, "extracted");

    try {
      await mkdir(packDestination);
      await mkdir(extractionDestination);

      const output = execFileSync(
        "npm",
        ["pack", "--json", "--ignore-scripts", "--pack-destination", packDestination],
        { cwd: projectRoot, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
      );
      const packed = JSON.parse(output) as PackResult[];
      expect(packed).toHaveLength(1);
      expect(packed[0].filename).toMatch(/\.tgz$/);

      const tarball = join(packDestination, packed[0].filename);
      await access(tarball);
      execFileSync("tar", ["-xzf", tarball, "-C", extractionDestination], { stdio: "pipe" });

      const packageRoot = join(extractionDestination, "package");
      await Promise.all(expectedTargets.map((target) => access(join(packageRoot, target))));

      const smokeFile = join(packageRoot, "consumer-smoke.mjs");
      await writeFile(
        smokeFile,
        [
          'import * as root from "blossom-client-sdk";',
          'import * as exact from "blossom-client-sdk/hashtree";',
          'import * as wildcardIndex from "blossom-client-sdk/hashtree/index";',
          'import * as types from "blossom-client-sdk/hashtree/types";',
          'import * as errors from "blossom-client-sdk/hashtree/errors";',
          'import * as chk from "blossom-client-sdk/hashtree/chk";',
          'import * as blossomReference from "blossom-client-sdk/hashtree/blossom-reference";',
          'import assert from "node:assert/strict";',
          "const runtimeNames = Object.keys(exact).sort();",
          "const errorNames = runtimeNames.filter((name) => name.endsWith('Error'));",
          "assert.deepEqual(Object.keys(wildcardIndex).sort(), runtimeNames);",
          "assert.deepEqual(Object.keys(errors).sort(), errorNames);",
          "assert.deepEqual(Object.keys(types), []);",
          "assert.ok(runtimeNames.includes('HashtreeError'));",
          "assert.equal(chk.encryptChk, exact.encryptChk);",
          "assert.equal(chk.decryptChk, exact.decryptChk);",
          "assert.equal(chk.hashHashtreeContent, exact.hashHashtreeContent);",
          "assert.equal(blossomReference.parseHashtreeBlossomReference, exact.parseHashtreeBlossomReference);",
          "assert.equal(blossomReference.buildHashtreeBlossomReference, exact.buildHashtreeBlossomReference);",
          "for (const name of ['encryptChk', 'decryptChk', 'hashHashtreeContent', 'parseHashtreeBlossomReference', 'buildHashtreeBlossomReference']) assert.equal(Object.hasOwn(root, name), false);",
          "assert.equal(Object.keys(root).some((name) => /hashtree/i.test(name)), false);",
        ].join("\n"),
      );

      execFileSync(process.execPath, [smokeFile], { cwd: packageRoot, stdio: "pipe" });
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
});
