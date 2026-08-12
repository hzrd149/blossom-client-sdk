import { execFileSync } from "node:child_process";
import { access, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { describe, expect, it } from "vitest";

const projectRoot = resolve(fileURLToPath(new URL("../..", import.meta.url)));
const libRoot = join(projectRoot, "lib");
const hashtreeRoot = join(libRoot, "hashtree");
const hashtreeRuntimeNames = [
  "HashtreeBoundsError",
  "HashtreeCallbackError",
  "HashtreeConflictError",
  "HashtreeError",
  "HashtreeIntegrityError",
  "HashtreeLifecycleError",
  "HashtreeValidationError",
  "ImmutableTreeError",
];

type Graph = {
  readonly bareSpecifiers: Set<string>;
  readonly visited: Set<string>;
};

async function walkEmittedGraph(entry: string): Promise<Graph> {
  const absoluteEntry = resolve(entry);
  await assertFileExists(absoluteEntry, "build entry");

  const graph: Graph = { bareSpecifiers: new Set(), visited: new Set() };
  const pending = [absoluteEntry];

  while (pending.length > 0) {
    const file = pending.pop()!;
    if (graph.visited.has(file)) continue;
    graph.visited.add(file);

    const source = await readFile(file, "utf8");
    for (const specifier of emittedSpecifiers(source)) {
      if (!specifier.startsWith(".")) {
        graph.bareSpecifiers.add(specifier);
        continue;
      }

      const target = resolve(dirname(file), specifier);
      await assertFileExists(target, `relative edge ${specifier} from ${relative(projectRoot, file)}`);
      pending.push(target);
    }
  }

  return graph;
}

function emittedSpecifiers(source: string): Set<string> {
  const specifiers = new Set<string>();
  const staticImportOrExport = /(?:import|export)\s+(?:[^"'();]*?\s+from\s*)?["']([^"']+)["']/g;
  const literalDynamicImport = /import\(\s*["']([^"']+)["']\s*\)/g;

  for (const pattern of [staticImportOrExport, literalDynamicImport]) {
    for (const match of source.matchAll(pattern)) specifiers.add(match[1]);
  }
  return specifiers;
}

async function assertFileExists(file: string, description: string): Promise<void> {
  try {
    await access(file);
  } catch {
    throw new Error(`Missing ${description}: ${file}`);
  }
}

async function observedHashtreeEvaluation(entry: string): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), "blossom-isolation-"));
  const loader = join(directory, "loader.mjs");
  const sentinel = join(directory, "evaluated.txt");
  const normalizedRoot = `${pathToFileURL(hashtreeRoot).href}/`;

  try {
    await writeFile(
      loader,
      [
        'import { appendFileSync } from "node:fs";',
        `const hashtreeRoot = ${JSON.stringify(normalizedRoot)};`,
        `const sentinel = ${JSON.stringify(sentinel)};`,
        "export async function load(url, context, nextLoad) {",
        "  const loaded = await nextLoad(url, context);",
        "  if (url.startsWith(hashtreeRoot) && loaded.format === 'module') {",
        '    return { ...loaded, source: `import { appendFileSync as __mark } from "node:fs"; __mark(${JSON.stringify(sentinel)}, "evaluated\\\\n");\\n${loaded.source}` };',
        "  }",
        "  return loaded;",
        "}",
      ].join("\n"),
    );

    execFileSync(process.execPath, ["--no-warnings", "--experimental-loader", loader, entry], {
      cwd: projectRoot,
      stdio: "pipe",
    });

    try {
      return await readFile(sentinel, "utf8");
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return "";
      throw error;
    }
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

describe("built root isolation", () => {
  it("contains no Hashtree runtime names", async () => {
    const root = await import("../../lib/index.js");
    for (const name of hashtreeRuntimeNames) expect(root).not.toHaveProperty(name);
  });

  it("does not evaluate Hashtree modules in a fresh process", async () => {
    expect(await observedHashtreeEvaluation(join(libRoot, "index.js"))).toBe("");
    expect(await observedHashtreeEvaluation(join(hashtreeRoot, "index.js"))).toContain("evaluated");
  });

  it("does not reach Hashtree output or exclusive dependencies", async () => {
    const graph = await walkEmittedGraph(join(libRoot, "index.js"));
    const exclusiveHashtreeDependencies: readonly string[] = [];

    for (const file of graph.visited) {
      const pathFromHashtree = relative(hashtreeRoot, file);
      expect(isAbsolute(pathFromHashtree) || pathFromHashtree.startsWith(".."), file).toBe(true);
    }
    for (const dependency of exclusiveHashtreeDependencies) {
      expect(graph.bareSpecifiers, dependency).not.toContain(dependency);
    }
  });

  it("fails closed for missing entries and unresolved relative edges", async () => {
    await expect(walkEmittedGraph(join(libRoot, "missing-entry.js"))).rejects.toThrow("Missing build entry");

    const directory = await mkdtemp(join(tmpdir(), "blossom-broken-graph-"));
    try {
      const brokenEntry = join(directory, "entry.js");
      await writeFile(brokenEntry, 'export * from "./missing.js";');
      await expect(walkEmittedGraph(brokenEntry)).rejects.toThrow("Missing relative edge ./missing.js");
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
});
