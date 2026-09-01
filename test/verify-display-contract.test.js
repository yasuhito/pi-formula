const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const harness = fs.readFileSync(
  path.resolve(__dirname, "../scripts/verify-display"),
  "utf8",
);

test("現在の pi-formula だけを公開 Pi CLI から読み込む", () => {
  assert.match(harness, /--no-extensions/u);
  assert.match(harness, /--extension "\$PI_FORMULA_VERIFY_EXTENSION"/u);
  assert.match(harness, /PI_FORMULA_VERIFY_EXTENSION=%q/u);
  assert.match(harness, /"\$ROOT\/src\/extension\.ts"/u);
});

test("応答一致を確認してからキャプチャする", () => {
  assert.ok(harness.indexOf("verify-echo.js") < harness.indexOf("run grim"));
});

test("process group とウィンドウを止めてから headless 出力を削除する", () => {
  const cleanup = harness.slice(harness.indexOf("cleanup()"));
  assert.ok(
    cleanup.indexOf("stop-display-process") < cleanup.indexOf("output remove"),
  );
  assert.match(harness, /setsid timeout/u);
  assert.match(harness, /read -r WINDOW_PID/u);
});
