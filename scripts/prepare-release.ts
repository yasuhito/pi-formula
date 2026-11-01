#!/usr/bin/env node
import { isRecord, parseJson } from "../test/support/json-value.js";
import {
  type PackedPackage,
  parsePackedPackage,
} from "../test/support/npm-pack.js";

const {
  mkdirSync,
  readFileSync,
  writeFileSync,
}: typeof import("node:fs") = require("node:fs");

import { spawnSync } from "node:child_process";
import { join, resolve } from "node:path";
import { extractReleaseNotes } from "./release-notes";

const root = resolve(__dirname, "..");
const tag = process.argv[2];
const outputDirectory = resolve(process.argv[3] ?? join(root, ".release"));
const manifest = parseJson(readFileSync(join(root, "package.json"), "utf8"));
if (
  !isRecord(manifest) ||
  typeof manifest.name !== "string" ||
  typeof manifest.version !== "string"
)
  throw new TypeError("Invalid package manifest");
const expectedTag = `v${manifest.version}`;

function fail(message: string): never {
  process.stderr.write(`Release preparation failed: ${message}\n`);
  process.exit(1);
}

if (!/^v(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)$/u.test(tag ?? "")) {
  fail("tag must have the form vX.Y.Z");
}
if (tag !== expectedTag) {
  fail(`tag ${tag} does not match package.json version ${manifest.version}`);
}

const changelog = readFileSync(join(root, "CHANGELOG.md"), "utf8");
const releaseNotes = extractReleaseNotes(changelog, manifest.version);
if (!releaseNotes) {
  fail(`CHANGELOG.md has no bullet list for ${manifest.version}`);
}

mkdirSync(outputDirectory, { recursive: true });
const packed = spawnSync(
  "npm",
  ["pack", "--json", "--pack-destination", outputDirectory],
  {
    cwd: root,
    encoding: "utf8",
  },
);
if (packed.status !== 0) {
  fail(packed.stderr.trim() || "npm pack failed");
}

let packResult: PackedPackage;
try {
  packResult = parsePackedPackage(packed.stdout, manifest.name);
} catch {
  fail("npm pack did not return JSON");
}
if (!packResult.files) fail("npm pack did not return a file list");

const topLevel = [
  ...new Set(packResult.files.map(({ path }) => path.split("/")[0])),
].sort();
const expectedTopLevel = [
  "CHANGELOG.md",
  "LICENSE",
  "README.ja.md",
  "README.md",
  "THIRD_PARTY_NOTICES.md",
  "assets",
  "dist",
  "package.json",
  "src",
];
if (JSON.stringify(topLevel) !== JSON.stringify(expectedTopLevel)) {
  fail(`unexpected tarball contents: ${topLevel.join(", ")}`);
}

writeFileSync(join(outputDirectory, "release-notes.md"), releaseNotes);
process.stdout.write(
  `Prepared ${packResult.filename} for pi-formula ${manifest.version}\n`,
);
