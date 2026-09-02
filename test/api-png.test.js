const assert = require("node:assert/strict");
const { mkdtempSync, writeFileSync } = require("node:fs");
const { tmpdir } = require("node:os");
const { join } = require("node:path");
const test = require("node:test");

const formula = require("..");
const { FORMULA_SAFETY_LIMITS } = require("../dist/typesetter.js");
const { createPngFromScanlines } = require("./support/png-fixture.js");
const {
  fakePi,
  resetFormulaState,
  startWithKitty,
  startWithText,
} = require("./support/fake-pi");

function pngWithDimensions(width, height) {
  return createPngFromScanlines(
    width,
    height,
    Buffer.alloc(height * (width + 1)),
    0,
  );
}

async function useImagePath() {
  const pi = fakePi();
  formula.registerFormula(pi.api);
  await startWithKitty(pi);
}

test.beforeEach(() => resetFormulaState());

test("getFormulaPath defaults to the text path before registration", () => {
  assert.equal(formula.getFormulaPath(), "text");
});

test("renderPng returns fallback information on the text path", async () => {
  const pi = fakePi();
  formula.registerFormula(pi.api);
  await startWithText(pi);

  assert.deepEqual(formula.renderPng(Buffer.alloc(0), 80), {
    rendered: false,
    reason: "image-unavailable",
  });
});

test("renderPng lays out and transfers a PNG buffer", async () => {
  await useImagePath();

  const result = formula.renderPng(pngWithDimensions(100, 50), 8);

  assert.deepEqual(
    {
      rendered: result.rendered,
      transfer: result.output?.includes("\x1b_Ga=T,f=100"),
      placeholder: result.output?.includes(String.fromCodePoint(0x10eeee)),
      withinWidth: result.columns <= 8,
      positiveSize:
        result.widthPx > 0 && result.heightPx > 0 && result.rows > 0,
    },
    {
      rendered: true,
      transfer: true,
      placeholder: true,
      withinWidth: true,
      positiveSize: true,
    },
  );
});

test("renderPng reads a PNG file", async () => {
  await useImagePath();
  const directory = mkdtempSync(join(tmpdir(), "pi-formula-png-"));
  const path = join(directory, "existing.png");
  writeFileSync(path, pngWithDimensions(120, 60));

  const result = formula.renderPng(path, 10);

  assert.equal(result.rendered && result.output.includes("iVBOR"), true);
});

test("renderPng rejects a missing PNG file without throwing", async () => {
  await useImagePath();

  assert.deepEqual(formula.renderPng("/missing/pi-formula.png", 80), {
    rendered: false,
    reason: "invalid-png",
  });
});

test("renderPng rejects invalid PNG data", async () => {
  await useImagePath();

  assert.deepEqual(formula.renderPng(Buffer.from("not a PNG"), 80), {
    rendered: false,
    reason: "invalid-png",
  });
});

test("renderPng rejects a truncated PNG", async () => {
  await useImagePath();
  const png = pngWithDimensions(10, 10);

  assert.deepEqual(formula.renderPng(png.subarray(0, png.length - 5), 80), {
    rendered: false,
    reason: "invalid-png",
  });
});

test("renderPng rejects a non-regular file without reading it", {
  skip: process.platform === "win32",
}, async () => {
  await useImagePath();

  assert.deepEqual(formula.renderPng("/dev/zero", 80), {
    rendered: false,
    reason: "invalid-png",
  });
});

test("renderPng rejects an invalid available width", async () => {
  await useImagePath();

  assert.deepEqual(formula.renderPng(pngWithDimensions(10, 10), 0), {
    rendered: false,
    reason: "invalid-png",
  });
});

test("renderPng rejects a PNG exceeding the row limit", async () => {
  await useImagePath();

  assert.deepEqual(formula.renderPng(pngWithDimensions(1, 100_000), 80), {
    rendered: false,
    reason: "safety-limit",
  });
});

test("renderPng rejects a PNG exceeding the byte limit", async () => {
  await useImagePath();
  const png = Buffer.alloc(FORMULA_SAFETY_LIMITS.pngBytes + 1);

  assert.deepEqual(formula.renderPng(png, 80), {
    rendered: false,
    reason: "safety-limit",
  });
});

test("renderPng rejects a PNG exceeding the expanded pixel limit", async () => {
  await useImagePath();
  const png = pngWithDimensions(3000, 2000);

  assert.deepEqual(formula.renderPng(png, 80), {
    rendered: false,
    reason: "safety-limit",
  });
});
