const {
  existsSync,
  readdirSync,
  rmSync,
}: typeof import("node:fs") = require("node:fs");
const { join, resolve }: typeof import("node:path") = require("node:path");
const root = resolve(__dirname, "..");
const retainBootstrap = !process.argv.includes("--analyze-sources");
const compatibilityFiles = new Set(["clean-dist", "vt-tool", "run-vt-pty"]);
function cleanDirectory(directory: string): void {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      cleanDirectory(path);
      continue;
    }
    const base = entry.name.replace(/\.(?:ts|js(?:\.map)?)$/u, "");
    if (
      retainBootstrap &&
      directory === join(root, "scripts") &&
      compatibilityFiles.has(base)
    )
      continue;
    if (entry.name.endsWith(".js.map")) {
      rmSync(path.slice(0, -4), { force: true });
      rmSync(path, { force: true });
    } else if (entry.name.endsWith(".ts") && !entry.name.endsWith(".d.ts")) {
      const generated = path.replace(/\.ts$/u, ".js");
      rmSync(generated, { force: true });
      rmSync(`${generated}.map`, { force: true });
    }
  }
}
// Knip analyzes original TS rather than generated JS; source maps also identify orphan outputs.
for (const directory of ["scripts", "test", "features/support"]) {
  const path = join(root, directory);
  if (existsSync(path)) cleanDirectory(path);
}
