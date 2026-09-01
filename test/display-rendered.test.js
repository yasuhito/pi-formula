const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const { spawnSync } = require("node:child_process");

const { createPng } = require("./support/png-fixture");
const checker = path.resolve(__dirname, "../scripts/check-display-rendered.js");

function check({ capture, previous }) {
  const directory = fs.mkdtempSync(
    path.join(os.tmpdir(), "pi-formula-rendered-"),
  );
  const capturePath = path.join(directory, "capture.png");
  fs.writeFileSync(
    capturePath,
    Buffer.isBuffer(capture) ? capture : createPng(120, 80, capture),
  );
  const args = ["--background=250,248,240", "--background=238,235,224"];
  if (previous) {
    const previousPath = path.join(directory, "previous.png");
    fs.writeFileSync(previousPath, createPng(120, 80, previous));
    args.push(`--previous=${previousPath}`);
  }
  const result = spawnSync(process.execPath, [checker, ...args, capturePath], {
    encoding: "utf8",
    timeout: 5_000,
  });
  fs.rmSync(directory, { recursive: true, force: true });
  return result;
}

function terminalCapture(textRows) {
  return (x, y) => {
    if (y >= 8 && y < 8 + textRows && x >= 8 && x <= 70 && x % 4 < 2)
      return [40, 40, 35];
    return [250, 248, 240];
  };
}

const blankCapture = () => [250, 248, 240];

test("描画があり前回のキャプチャと同一なら描画完了として受理する", () => {
  assert.equal(
    check({ capture: terminalCapture(6), previous: terminalCapture(6) }).status,
    0,
  );
});

test("引用ブロック背景の上の描画も背景として数えて受理する", () => {
  const blockCapture = (x, y) => {
    if (y >= 8 && y <= 40 && x >= 20 && x <= 95 && x % 6 < 3)
      return [40, 40, 35];
    if (y >= 4 && y <= 60) return [238, 235, 224];
    return [250, 248, 240];
  };
  assert.equal(
    check({ capture: blockCapture, previous: blockCapture }).status,
    0,
  );
});

test("前回のキャプチャと異なるなら描画中として再試行を求める", () => {
  assert.equal(
    check({ capture: terminalCapture(6), previous: terminalCapture(3) }).status,
    1,
  );
});

test("前回のキャプチャがなければ比較できないので再試行を求める", () => {
  assert.equal(check({ capture: terminalCapture(6) }).status, 1);
});

test("描画がまったくないキャプチャは再試行を求める", () => {
  assert.equal(
    check({ capture: blankCapture, previous: blankCapture }).status,
    1,
  );
});

test("端末背景が写っていないキャプチャは再試行を求める", () => {
  const foreign = () => [37, 37, 34];
  assert.equal(check({ capture: foreign, previous: foreign }).status, 1);
});

test("PNG として読めないキャプチャは検証不能として停止する", () => {
  assert.equal(check({ capture: Buffer.from("PNG ではないデータ") }).status, 2);
});
