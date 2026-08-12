import { describe, expect, it } from "vitest";

import * as hashtree from "../../src/hashtree/index.js";
import * as root from "../../src/index.js";
import type { ByteStream, HashtreeCallback, HashtreeOperationOptions, MaybePromise } from "../../src/hashtree/index.js";

const expectedRuntimeExports = [
  "HashtreeBoundsError",
  "HashtreeCallbackError",
  "HashtreeConflictError",
  "HashtreeError",
  "HashtreeIntegrityError",
  "HashtreeLifecycleError",
  "HashtreeValidationError",
  "ImmutableTreeError",
];

describe("Hashtree package boundary", () => {
  it("exposes only the curated runtime error classes", () => {
    expect(Object.keys(hashtree).sort()).toEqual(expectedRuntimeExports);

    const bytes: ByteStream = (async function* () {
      yield new Uint8Array([1]);
    })();
    const options: HashtreeOperationOptions = { signal: new AbortController().signal };
    const callback: HashtreeCallback<number, string> = (value) => String(value);
    const result: MaybePromise<string> = callback(1);

    expect(bytes).toBeDefined();
    expect(options.signal).toBeInstanceOf(AbortSignal);
    expect(result).toBe("1");
  });

  it("keeps Hashtree runtime exports off the root entrypoint", () => {
    for (const name of expectedRuntimeExports) expect(root).not.toHaveProperty(name);
  });
});

describe.runIf(typeof document === "undefined")("built Hashtree declarations", () => {
  it("emits exact and wildcard targets without Node-only types", async () => {
    const [{ mkdtemp, readFile, rm, writeFile }, { join }, { execFileSync }] = await Promise.all([
      import("node:fs/promises"),
      import("node:path"),
      import("node:child_process"),
    ]);
    const directory = await mkdtemp(join(process.cwd(), ".tmp-hashtree-"));

    try {
      const declarations = await Promise.all(
        ["index", "types", "errors"].map((name) => readFile(`lib/hashtree/${name}.d.ts`, "utf8")),
      );
      expect(declarations.join("\n")).not.toMatch(/\b(?:Buffer|NodeJS)\b|node:|(?:Read|Write)Stream|FileSystem/);

      await writeFile(
        join(directory, "consumer.ts"),
        [
          'import { HashtreeError } from "blossom-client-sdk/hashtree";',
          'import type { ByteStream } from "blossom-client-sdk/hashtree/types";',
          'import { HashtreeBoundsError } from "blossom-client-sdk/hashtree/errors";',
          "const stream: ByteStream = (async function* () { yield new Uint8Array(); })();",
          'void [stream, new HashtreeError("failure"), new HashtreeBoundsError("bounds", { limit: 1, actual: 2 })];',
        ].join("\n"),
      );
      await writeFile(
        join(directory, "tsconfig.json"),
        JSON.stringify({
          compilerOptions: {
            target: "ES2022",
            module: "NodeNext",
            moduleResolution: "NodeNext",
            lib: ["ES2022", "DOM", "DOM.Iterable"],
            types: [],
            strict: true,
            noEmit: true,
          },
          files: ["consumer.ts"],
        }),
      );
      execFileSync(join(process.cwd(), "node_modules/.bin/tsc"), ["-p", join(directory, "tsconfig.json")], {
        cwd: process.cwd(),
        stdio: "pipe",
      });
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
});

describe.runIf(typeof document !== "undefined")("browser Hashtree entrypoint", () => {
  it("loads the built runtime without Node globals", async () => {
    const built = await import("../../lib/hashtree/index.js");
    expect(Object.keys(built).sort()).toEqual(expectedRuntimeExports);
  });
});
