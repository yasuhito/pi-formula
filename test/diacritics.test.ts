import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { encodePlaceholderRows } from "../dist/kitty.js";

// Source: https://github.com/kovidgoyal/kitty/blob/master/gen/rowcolumn-diacritics.txt
const header = readFileSync("native/diacritics.h", "utf8");
const initializer = /DIACRITICS\[\]\s*=\s*\{([^}]+)\}/u.exec(header)?.[1] ?? "";
const nativeCodePoints = initializer
  .split(",")
  .map((hex) => Number.parseInt(hex.trim(), 16));
const nativeLength = Number(/DIACRITICS_LEN\s*=\s*(\d+)/u.exec(header)?.[1]);

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
