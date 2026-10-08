import { spawnSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";
import { parsePackedPackage } from "./npm-pack.js";

function installPackedPackage(projectRoot: string, trialRoot: string) {
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
  const candidate = parsePackedPackage(packed.stdout);
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

export { installPackedPackage };
