const assert = require("node:assert/strict");
const test = require("node:test");

const {
  pngSize,
  verifyPngDimensions,
} = require("../scripts/verify-display-dimensions");
const { createPng } = require("./support/png-fixture");

test("計画より短い PNG キャプチャを拒否する", () => {
  const png = createPng(120, 79, () => [250, 248, 240]);
  assert.throws(() => verifyPngDimensions(png, 120, 80), /120x80/u);
});

test("キャプチャの寸法を幅x高さで読み出す", () => {
  const png = createPng(120, 80, () => [250, 248, 240]);
  assert.equal(pngSize(png), "120x80");
});

test("PNG でないキャプチャの寸法は読み出せない", () => {
  assert.throws(() => pngSize(Buffer.from("PNG ではないデータ")), /PNG/u);
});
