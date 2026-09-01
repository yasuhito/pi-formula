const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const harness = fs.readFileSync(
  path.resolve(__dirname, "../scripts/verify-display"),
  "utf8",
);

test("利用者の Pi 拡張を読み込まない", () => {
  assert.match(harness, /--no-extensions/u);
});

test("現在の pi-formula 拡張を明示する", () => {
  assert.match(harness, /--extension "\$PI_FORMULA_VERIFY_EXTENSION"/u);
});

test("現在の pi-formula 拡張パスを runner へ渡す", () => {
  assert.match(harness, /PI_FORMULA_VERIFY_EXTENSION=%q/u);
});

test("現在の checkout にある pi-formula 拡張を使う", () => {
  assert.match(harness, /"\$ROOT\/src\/extension\.ts"/u);
});

test("保存済み path text を一時設定で隔離する", () => {
  assert.match(harness, /XDG_CONFIG_HOME="\$PI_FORMULA_VERIFY_CONFIG_HOME"/u);
});

test("利用者マクロを空に固定する", () => {
  assert.match(harness, /PI_FORMULA_MACROS='\{\}'/u);
});

test("画像経路を確認してからキャプチャする", () => {
  assert.ok(
    harness.indexOf("verify-image-path.js") < harness.indexOf("run grim"),
  );
});

test("応答一致を確認してからキャプチャする", () => {
  assert.ok(harness.indexOf("verify-echo.js") < harness.indexOf("run grim"));
});

test("表示数式の画像行数で出力高を決めてから headless 出力を作る", () => {
  assert.ok(
    harness.indexOf("plan-display.js") <
      harness.indexOf("output create headless"),
  );
});

test("process group を止めてから headless 出力を削除する", () => {
  const cleanup = harness.slice(harness.indexOf("cleanup()"));
  assert.ok(
    cleanup.indexOf("stop-display-process") < cleanup.indexOf("output remove"),
  );
});

test("Ghostty を専用 process group で起動する", () => {
  assert.match(harness, /setsid timeout/u);
});

test("Ghostty の process group ID を保存する", () => {
  assert.match(harness, /read -r WINDOW_PID/u);
});

test("ビルドへ独立した長い時間上限を使う", () => {
  assert.match(
    harness,
    /BUILD_TIMEOUT=120[\s\S]*timeout --signal=TERM "\$BUILD_TIMEOUT" npm run build/u,
  );
});

test("最大画像の判定へ30秒の時間上限を使う", () => {
  assert.match(
    harness,
    /DETECTOR_TIMEOUT=30[\s\S]*timeout --signal=TERM "\$DETECTOR_TIMEOUT" node "\$ROOT\/scripts\/detect-display-bands\.js"/u,
  );
});
