const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const { spawnSync } = require("node:child_process");

const { createPng } = require("./support/png-fixture");
const verifier = path.resolve(
  __dirname,
  "../scripts/verify-display-capture.js",
);

function verify(pixel) {
  const directory = fs.mkdtempSync(
    path.join(os.tmpdir(), "pi-formula-capture-"),
  );
  const capture = path.join(directory, "capture.png");
  fs.writeFileSync(capture, createPng(120, 80, pixel));
  const result = spawnSync(
    process.execPath,
    [verifier, "--background=250,248,240", "--image-rows=1", capture],
    { encoding: "utf8", timeout: 5_000 },
  );
  fs.rmSync(directory, { recursive: true, force: true });
  return result;
}

function terminalCapture(withImage) {
  return (x, y) => {
    if (y >= 8 && y <= 14 && x >= 8 && x <= 70 && x % 4 < 2)
      return [40, 40, 35];
    if (withImage && y >= 30 && y <= 45 && x >= 20 && x <= 95 && x % 6 < 3)
      return [40, 40, 35];
    return [250, 248, 240];
  };
}

test("表示数式の画像行がある端末キャプチャを受理する", () => {
  assert.equal(verify(terminalCapture(true)).status, 0);
});

test("表示数式の画像行がない端末キャプチャを拒否する", () => {
  assert.equal(verify(terminalCapture(false)).status, 2);
});

test("headless 出力の背景だけのキャプチャを拒否する", () => {
  assert.equal(verify(() => [37, 37, 34]).status, 2);
});

test("中央に入力欄があるぼかしたロック画面を拒否する", () => {
  const lockScreen = (x, y) => {
    if (y >= 20 && y <= 60 && x >= 20 && x <= 100) {
      const shade = 35 + Math.floor((y - 20) * 4.5);
      if (y >= 38 && y <= 44 && x >= 44 && x <= 76 && x % 5 < 2)
        return [232, 230, 218];
      return [shade, shade, Math.max(0, shade - 3)];
    }
    return [250, 248, 240];
  };
  assert.equal(verify(lockScreen).status, 2);
});
