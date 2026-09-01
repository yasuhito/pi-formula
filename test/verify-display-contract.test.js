const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const harness = fs.readFileSync(
  path.resolve(__dirname, "../scripts/verify-display"),
  "utf8",
);
const cleanupHarness = fs.readFileSync(
  path.resolve(__dirname, "../scripts/cleanup-display"),
  "utf8",
);
const runFunction = harness.slice(
  harness.indexOf("run()"),
  harness.indexOf("cleanup()"),
);

function markersAppearInOrder(source, ...markers) {
  let previous = -1;
  for (const marker of markers) {
    const position = source.indexOf(marker, previous + 1);
    if (position < 0) return false;
    previous = position;
  }
  return true;
}

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

test("検証専用の追加マクロ拡張を読み込む", () => {
  assert.match(harness, /--extension "\$PI_FORMULA_VERIFY_MACROS_EXTENSION"/u);
});

test("画像経路を確認してからキャプチャする", () => {
  assert.ok(markersAppearInOrder(harness, "verify-image-path.js", "run grim"));
});

test("応答一致を確認してからキャプチャする", () => {
  assert.ok(markersAppearInOrder(harness, "verify-echo.js", "run grim"));
});

test("出力作成を始める前に後片付けを有効にする", () => {
  assert.ok(
    markersAppearInOrder(
      harness,
      "OUTPUT_CREATED=true",
      "output create headless",
    ),
  );
});

test("表示数式の画像行数で出力高を決めてから headless 出力を作る", () => {
  assert.ok(
    markersAppearInOrder(harness, "plan-display.js", "output create headless"),
  );
});

test("計画した monitor 寸法を確認してから起動する", () => {
  assert.ok(
    markersAppearInOrder(
      harness,
      'verify-display-dimensions.js" monitor',
      "hl.dsp.exec_cmd",
    ),
  );
});

test("画面ロック状態を描画とheadless出力作成より前に確認する", () => {
  assert.ok(
    markersAppearInOrder(
      harness,
      "check-display-lock",
      "npm run build",
      "output create headless",
    ),
  );
});

test("キャプチャ直前にも画面ロック状態を再確認する", () => {
  assert.ok(
    markersAppearInOrder(
      harness,
      "verify-echo.js",
      "check-display-lock",
      'grim -o "$OUTPUT_NAME"',
    ),
  );
});

test("headless 出力から検証ウィンドウの矩形だけを切り出す", () => {
  assert.ok(
    markersAppearInOrder(
      harness,
      'grim -o "$OUTPUT_NAME"',
      "crop-display-capture.js",
      '"$CAPTURE_FILE"',
    ),
  );
});

test("描画完了をピクセル判定前に確認する", () => {
  assert.ok(
    markersAppearInOrder(
      harness,
      "check-display-rendered.js",
      "detect-display-bands.js",
    ),
  );
});

test("描画完了を確認するまでキャプチャを再試行する", () => {
  assert.ok(
    markersAppearInOrder(
      harness,
      "SECONDS < capture_deadline",
      "run grim -o",
      "check-display-rendered.js",
    ),
  );
});

test("再試行の期限を実時間で測る", () => {
  assert.match(
    harness,
    /capture_deadline=\$\(\(SECONDS \+ CAPTURE_READY_TIMEOUT\)\)/u,
  );
});

test("描画未完了だけ再試行し検査の実行失敗は停止する", () => {
  assert.match(
    harness,
    /run-display-command" poll check-display-rendered[\s\S]*check-display-rendered\.js/u,
  );
});

test("前回のキャプチャと比べて描画の安定を判定する", () => {
  assert.ok(
    markersAppearInOrder(
      harness,
      "check-display-rendered.js",
      '"$PREVIOUS_CAPTURE_FILE"',
      "--previous=$PREVIOUS_CAPTURE_FILE",
    ),
  );
});

test("引用ブロック背景も端末背景として渡す", () => {
  assert.match(harness, /--background=250,248,240 --background=238,235,224/u);
});

test("キャプチャ待機中も画面ロックを検査してから再試行する", () => {
  assert.ok(
    markersAppearInOrder(
      harness,
      "SECONDS < capture_deadline",
      "check-display-rendered.js",
      "check-display-lock",
      "run sleep",
    ),
  );
});

test("キャプチャ待機中のロック検出を理由に含めて報告する", () => {
  assert.match(harness, /キャプチャ待機中に画面ロックを検出したか/u);
});

test("描画完了を確認できない場合は検証不能で停止する", () => {
  assert.match(
    harness,
    /Ghostty の描画完了をキャプチャで確認できませんでした/u,
  );
});

test("確認できたキャプチャだけを保存する", () => {
  assert.ok(
    markersAppearInOrder(
      harness,
      "Ghostty の描画完了をキャプチャで確認できませんでした",
      "PI_FORMULA_VERIFY_CAPTURE",
    ),
  );
});

test("保存先の指定がなくても既定の場所へキャプチャを残す", () => {
  assert.match(
    harness,
    /CAPTURE_DESTINATION=\$\{PI_FORMULA_VERIFY_CAPTURE:-\$\{XDG_STATE_HOME:-\$HOME\/\.local\/state\}\/pi-formula\/verify-display-capture\.png\}/u,
  );
});

test("キャプチャの保存先を必ず報告する", () => {
  assert.ok(
    markersAppearInOrder(
      harness,
      'install -m 0644 "$CAPTURE_FILE" "$CAPTURE_DESTINATION"',
      "キャプチャ: %s",
      "detect-display-bands.js",
    ),
  );
});

test("帯を見つけたらキャプチャの確認を促す", () => {
  assert.match(harness, /キャプチャを開いて表示を確認してください/u);
});

test("キャプチャの PNG 寸法をピクセル判定前に確認する", () => {
  assert.ok(
    markersAppearInOrder(
      harness,
      "run grim",
      'verify-display-dimensions.js" png',
      "detect-display-bands.js",
    ),
  );
});

test("終了処理を十分な時間上限の後片付けへ委譲する", () => {
  assert.match(
    harness,
    /timeout --signal=TERM 48 "\$ROOT\/scripts\/cleanup-display"/u,
  );
});

test("process group を止めてから headless 出力を削除する", () => {
  assert.ok(
    markersAppearInOrder(
      cleanupHarness,
      "stop-display-process",
      "output remove",
    ),
  );
});

test("順序判定は欠けた marker を拒否する", () => {
  assert.equal(markersAppearInOrder("first third", "first", "second"), false);
});

test("Ghostty を専用 process group で起動する", () => {
  assert.match(harness, /setsid timeout/u);
});

test("Ghostty の process group ID を保存する", () => {
  assert.match(harness, /read -r WINDOW_PID/u);
});

test("通常コマンドの失敗を実行基盤エラーへ正規化する", () => {
  assert.match(runFunction, /run-display-command" infrastructure "\$1"/u);
});

test("後片付けで外部trコマンドを使わない", () => {
  assert.doesNotMatch(cleanupHarness, /\btr\b/u);
});

test("grim を時間上限付きの通常コマンドとして実行する", () => {
  assert.deepEqual(
    {
      runUsesTimeout: /run\(\).*timeout/su.test(harness),
      grimUsesRun: /^\s*run grim -o/mu.test(harness),
    },
    { runUsesTimeout: true, grimUsesRun: true },
  );
});

test("ビルド出力を捨てない", () => {
  const build = harness.match(
    /run-display-command" infrastructure npm \\\n {2}timeout[^\n]*npm run build[^\n]*/u,
  )?.[0];
  assert.equal(build?.includes("/dev/null"), false);
});

test("ビルドへ独立した長い時間上限を使う", () => {
  assert.match(
    harness,
    /BUILD_TIMEOUT=120[\s\S]*timeout --signal=TERM "\$BUILD_TIMEOUT" npm run build/u,
  );
});

test("Ghosttyの寿命に各段の期限とキャプチャの余裕を含める", () => {
  assert.match(harness, /WINDOW_LIFETIME=240/u);
});

test("キャプチャの前後で検証ウィンドウの存在を確認する", () => {
  assert.match(
    harness,
    /verify-display-window[\s\S]*run grim[\s\S]*verify-display-window/u,
  );
});

test("セッション待機だけ未完了の終了コード1を保つ", () => {
  assert.match(
    harness,
    /run-display-command" poll check-display-session[\s\S]*check-display-session\.js/u,
  );
});

test("ピクセル判定だけ専用の終了コード規則を使う", () => {
  assert.match(
    harness,
    /run-display-command" detector detect-display-bands[\s\S]*detect-display-bands\.js/u,
  );
});

test("最大画像の判定へ30秒の時間上限を使う", () => {
  assert.match(
    harness,
    /DETECTOR_TIMEOUT=30[\s\S]*timeout --signal=TERM "\$DETECTOR_TIMEOUT" node "\$ROOT\/scripts\/detect-display-bands\.js"/u,
  );
});
