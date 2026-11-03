import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, before, test } from "node:test";
import { encodePlaceholderRows } from "../dist/kitty.js";

let probeDirectory = "";
let nativeLength = Number.NaN;
let nativeCodePoints: number[] = [];

function successfulOutput(
  operation: string,
  result: ReturnType<typeof spawnSync>,
): string {
  if (result.error) throw result.error;
  if (result.status !== 0)
    throw new Error(`${operation} failed:\n${String(result.stderr)}`);
  return String(result.stdout);
}

before(() => {
  probeDirectory = mkdtempSync(join(tmpdir(), "pi-formula-diacritics-"));
  const executable = join(probeDirectory, "diacritics-probe");
  successfulOutput(
    "native diacritics probe compilation",
    spawnSync(
      process.env.CC ?? "cc",
      [
        "-std=c11",
        "-Wall",
        "-Wextra",
        "-Werror",
        "-o",
        executable,
        "native/diacritics-probe.c",
      ],
      { encoding: "utf8" },
    ),
  );
  const observed = successfulOutput(
    "native diacritics probe",
    spawnSync(executable, { encoding: "utf8" }),
  )
    .trim()
    .split("\n")
    .map(Number);
  [nativeLength, ...nativeCodePoints] = observed;
});

after(() => {
  rmSync(probeDirectory, { force: true, recursive: true });
});

function placeholderCodePoints(rows: string[], coordinate: number): number[] {
  return rows.flatMap((row) =>
    Array.from(
      row.matchAll(/\u{10eeee}(.)(.)/gu),
      (cell) => cell[coordinate].codePointAt(0) ?? Number.NaN,
    ),
  );
}

test("native diacritics declares 297 entries", () => {
  assert.equal(nativeLength, 297);
});

test("native diacritics contains the declared number of code points", () => {
  assert.equal(nativeCodePoints.length, nativeLength);
});

test("Kitty diacritics does not accept a 298th entry", () => {
  assert.throws(() => encodePlaceholderRows(1, 298, 1), {
    message: "Formula image exceeds the Kitty placeholder coordinate range",
  });
});

test("native diacritics matches every Kitty column code point in order", () => {
  assert.deepEqual(
    nativeCodePoints,
    placeholderCodePoints(encodePlaceholderRows(1, 297, 1), 2),
  );
});

test("native diacritics matches every Kitty row code point in order", () => {
  assert.deepEqual(
    nativeCodePoints,
    placeholderCodePoints(encodePlaceholderRows(1, 1, 297), 1),
  );
});
