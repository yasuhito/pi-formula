const {
  readdir,
  readFile,
  stat,
}: typeof import("node:fs/promises") = require("node:fs/promises");
const {
  extname,
  join,
  relative,
  resolve,
}: typeof import("node:path") = require("node:path");

const root = resolve(__dirname, "..");
const extensions = new Set([
  ".js",
  ".jsx",
  ".mjs",
  ".cjs",
  ".ts",
  ".tsx",
  ".mts",
  ".cts",
]);
const sourceSibling: Record<string, string> = {
  ".js": ".ts",
  ".jsx": ".tsx",
  ".mjs": ".mts",
  ".cjs": ".cts",
};

async function sourceFiles(path: string): Promise<string[]> {
  if (!(await stat(path)).isDirectory()) {
    return extensions.has(extname(path)) ? [path] : [];
  }
  const entries = await readdir(path, { withFileTypes: true });
  const names = new Set(entries.map((entry) => entry.name));
  const files: string[] = [];
  for (const entry of entries) {
    const child = join(path, entry.name);
    if (entry.isDirectory()) {
      if (entry.name !== "node_modules" && entry.name !== ".git") {
        files.push(...(await sourceFiles(child)));
      }
    } else if (entry.isFile() && extensions.has(extname(entry.name))) {
      const extension = extname(entry.name);
      const sibling = sourceSibling[extension];
      if (
        !sibling ||
        !names.has(entry.name.slice(0, -extension.length) + sibling)
      ) {
        files.push(child);
      }
    }
  }
  return files;
}

async function allowedComment(raw: string): Promise<boolean> {
  const adr = /^\/\/ See docs\/adr\/([^/\\\r\n]+\.md)$/u.exec(raw);
  if (adr) {
    try {
      return (await stat(join(root, "docs", "adr", adr[1]))).isFile();
    } catch {
      return false;
    }
  }
  return /^\/\/ biome-ignore lint\/[A-Za-z][A-Za-z0-9]*\/[A-Za-z][A-Za-z0-9]*: \S[^\r\n]*$/u.test(
    raw,
  );
}

async function main() {
  const { parseSync } = await import("oxc-parser");
  const args = process.argv.slice(2);
  const inputs =
    args.length > 0
      ? args.map((path) => resolve(path))
      : ["src", "scripts", "test", "features"].map((path) => join(root, path));
  if (args.length === 0) {
    const entries = await readdir(root);
    if (entries.includes(".ultimate")) inputs.push(join(root, ".ultimate"));
  }
  const files = [
    ...new Set((await Promise.all(inputs.map(sourceFiles))).flat()),
  ].sort();
  let violations = 0;
  for (const file of files) {
    const source = await readFile(file, "utf8");
    const parsed = parseSync(file, source, { sourceType: "unambiguous" });
    const label = relative(root, file);
    if (parsed.errors.length > 0) {
      console.error(`${label}: Cannot parse: ${parsed.errors[0].message}`);
      violations += 1;
      continue;
    }
    for (const comment of parsed.comments) {
      if (await allowedComment(source.slice(comment.start, comment.end)))
        continue;
      const line = source.slice(0, comment.start).split("\n").length;
      console.error(
        `${label}:${line} Explanatory comments are not allowed; use an exact ADR reference or a biome-ignore directive with rule and reason.`,
      );
      violations += 1;
    }
  }
  console.log(
    `Comments: checked ${files.length} files, ${violations} violations`,
  );
  if (violations > 0) process.exitCode = 1;
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
