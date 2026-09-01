const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const { spawnSync } = require("node:child_process");

const { createPng } = require("./support/png-fixture");
const { decodePng } = require("../scripts/detect-display-bands");
const cropper = path.resolve(__dirname, "../scripts/crop-display-capture.js");

test("headless 出力から検証ウィンドウ矩形だけを切り出す", () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "pi-formula-crop-"));
  const source = path.join(directory, "source.png");
  const target = path.join(directory, "target.png");
  fs.writeFileSync(
    source,
    createPng(12, 10, (x, y) => [x, y, x + y]),
  );
  const result = spawnSync(
    process.execPath,
    [cropper, source, target, "3", "2", "7", "6"],
    { encoding: "utf8", timeout: 5_000 },
  );
  const image = decodePng(fs.readFileSync(target));
  fs.rmSync(directory, { recursive: true, force: true });

  assert.deepEqual(
    {
      status: result.status,
      size: [image.width, image.height],
      firstPixel: [...image.pixels.subarray(0, 3)],
    },
    { status: 0, size: [7, 6], firstPixel: [3, 2, 5] },
  );
});
