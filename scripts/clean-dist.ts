const {
  chmodSync,
  existsSync,
  rmSync,
}: typeof import("node:fs") = require("node:fs");
const { resolve }: typeof import("node:path") = require("node:path");
const {
  execFileSync,
}: typeof import("node:child_process") = require("node:child_process");
const root = resolve(__dirname, "..");
if (process.argv.includes("--tools")) {
  // Product-only checkouts and published packages do not contain development tools.
  const config = resolve(root, "tsconfig.tools.json");
  if (existsSync(config)) {
    execFileSync(process.execPath, [resolve(root, "scripts/clean-tools.ts")], {
      cwd: root,
      stdio: "inherit",
    });
    execFileSync("tsc", ["-p", config], { cwd: root, stdio: "inherit" });
    const nativeLauncher = resolve(root, "scripts/run-vt-pty.js");
    if (existsSync(nativeLauncher)) chmodSync(nativeLauncher, 0o755);
  }
} else {
  rmSync(resolve(root, "dist"), { recursive: true, force: true });
}
