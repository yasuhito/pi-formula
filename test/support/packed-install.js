const { mkdirSync, writeFileSync } = require("node:fs");
const { createRequire } = require("node:module");
const { join } = require("node:path");
const { spawnSync } = require("node:child_process");

function installPackedPackage(projectRoot, trialRoot) {
  const release = join(trialRoot, "release");
  const work = join(trialRoot, "work");
  mkdirSync(release);
  mkdirSync(work);
  writeFileSync(join(work, "package.json"), '{"private":true}\n');

  const packed = spawnSync(
    "npm",
    ["pack", "--json", "--pack-destination", release],
    { cwd: projectRoot, encoding: "utf8" },
  );
  if (packed.status !== 0) throw new Error(packed.stderr);
  const output = JSON.parse(packed.stdout);
  const candidate = Array.isArray(output)
    ? output[0]
    : (output["pi-formula"] ?? output);
  const installed = spawnSync(
    "npm",
    [
      "install",
      "--ignore-scripts",
      "--no-audit",
      "--no-fund",
      join(release, candidate.filename),
    ],
    { cwd: work, encoding: "utf8" },
  );
  if (installed.status !== 0) {
    throw new Error(installed.stderr || installed.stdout);
  }
  return createRequire(join(work, "package.json"));
}

module.exports = { installPackedPackage };
