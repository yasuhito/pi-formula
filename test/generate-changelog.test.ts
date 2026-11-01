import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, beforeEach, test } from "node:test";

const tool = resolve(__dirname, "../scripts/generate-changelog.ts");
const expected = `# Changelog

> Generated from release-metadata.json. DO NOT EDIT. Run \`npm run changelog:generate\`.

## 2.0.0 - 2026-11-01

- First note.
- Second note with \`code\`.

## 1.0.0 - 2026-09-09

- Original note.
`;
let directory: string;

beforeEach(() => {
  directory = mkdtempSync(join(tmpdir(), "pi-formula-changelog-"));
  writeFileSync(
    join(directory, "release-metadata.json"),
    JSON.stringify([
      {
        version: "2.0.0",
        date: "2026-11-01",
        notes: ["First note.", "Second note with `code`."],
      },
      { version: "1.0.0", date: "2026-09-09", notes: ["Original note."] },
    ]),
  );
});
afterEach(() => rmSync(directory, { recursive: true, force: true }));

function run(...args: string[]) {
  return spawnSync(process.execPath, [tool, ...args], {
    cwd: directory,
    encoding: "utf8",
    timeout: 30_000,
  });
}

function output() {
  return readFileSync(join(directory, "CHANGELOG.md"), "utf8");
}

test("generation exits successfully", () => {
  assert.equal(run().status, 0);
});

test("generation writes ordered deterministic Markdown", () => {
  run();
  assert.equal(output(), expected);
});

test("repeated generation leaves output unchanged", () => {
  run();
  const first = output();
  run();
  assert.equal(output(), first);
});

test("check succeeds for current output", () => {
  run();
  assert.equal(run("--check").status, 0);
});

test("check fails for stale output", () => {
  writeFileSync(join(directory, "CHANGELOG.md"), "stale\n");
  assert.equal(run("--check").status, 1);
});

test("stale check explains how to regenerate", () => {
  writeFileSync(join(directory, "CHANGELOG.md"), "stale\n");
  assert.match(run("--check").stderr, /npm run changelog:generate/u);
});

test("check does not modify stale output", () => {
  writeFileSync(join(directory, "CHANGELOG.md"), "stale\n");
  run("--check");
  assert.equal(output(), "stale\n");
});
