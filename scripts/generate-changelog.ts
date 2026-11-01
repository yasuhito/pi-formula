#!/usr/bin/env node
const {
  existsSync,
  readFileSync,
  writeFileSync,
}: typeof import("node:fs") = require("node:fs");

function renderRelease(release: unknown): string {
  if (
    typeof release !== "object" ||
    release === null ||
    !("version" in release) ||
    typeof release.version !== "string" ||
    !("date" in release) ||
    typeof release.date !== "string" ||
    !("notes" in release) ||
    !Array.isArray(release.notes) ||
    !release.notes.every((note: unknown) => typeof note === "string")
  ) {
    throw new TypeError(
      "Expected release version, date, and ordered note strings",
    );
  }
  return `## ${release.version} - ${release.date}\n\n${release.notes.map((note: string) => `- ${note}`).join("\n")}\n`;
}

const releases: unknown = JSON.parse(
  readFileSync("release-metadata.json", "utf8"),
);
if (!Array.isArray(releases))
  throw new TypeError("Expected an array of releases");
const expected = [
  "# Changelog\n",
  "> Generated from release-metadata.json. DO NOT EDIT. Run `npm run changelog:generate`.\n",
  ...releases.map(renderRelease),
].join("\n");

if (process.argv.includes("--check")) {
  if (
    !existsSync("CHANGELOG.md") ||
    readFileSync("CHANGELOG.md", "utf8") !== expected
  ) {
    process.stderr.write(
      "CHANGELOG.md is stale. Edit release-metadata.json and run npm run changelog:generate.\n",
    );
    process.exitCode = 1;
  }
} else {
  writeFileSync("CHANGELOG.md", expected);
}
