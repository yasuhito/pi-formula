const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const harness = fs.readFileSync(
  path.resolve(__dirname, "../scripts/verify-display"),
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

test("利用者の画面から独立した検証セッションで描画する", () => {
  assert.match(
    harness,
    /env -u WAYLAND_DISPLAY -u DISPLAY \\\n {2}WLR_BACKENDS=headless/u,
  );
});

test("検証セッションを専用 process group で起動する", () => {
  assert.match(harness, /setsid cage -d -- "\$LAUNCHER"/u);
});

test("検証セッションの出力を計画高へ広げる", () => {
  assert.match(harness, /--custom-mode "1920x\$\{PI_FORMULA_VERIFY_HEIGHT\}"/u);
});

test("出力を広げてから検証セッションの窓口を外へ伝える", () => {
  assert.ok(
    markersAppearInOrder(
      harness,
      "--custom-mode",
      'printf \'%s\\n\' "$WAYLAND_DISPLAY" >"$PI_FORMULA_VERIFY_DISPLAY_FILE"',
    ),
  );
});

test("キャプチャは検証セッションの窓口へ向ける", () => {
  assert.match(
    harness,
    /WAYLAND_DISPLAY="\$VERIFY_WAYLAND_DISPLAY" \\\n {4}"\$ROOT\/scripts\/run-display-command"/u,
  );
});

test("検証セッションが起動しない場合はログを添えて停止する", () => {
  assert.match(harness, /検証セッションが起動しませんでした/u);
});

test("計画した出力寸法を確認してから応答を待つ", () => {
  assert.ok(
    markersAppearInOrder(
      harness,
      '"$capture_size" == "1920x$HEIGHT"',
      "check-display-session.js",
    ),
  );
});

test("表示数式の画像行数で出力高を決めてから検証セッションを起動する", () => {
  assert.ok(markersAppearInOrder(harness, "plan-display.js", "setsid cage"));
});

test("画像経路を確認してからキャプチャする", () => {
  assert.ok(
    markersAppearInOrder(harness, "verify-image-path.js", "run_inside grim"),
  );
});

test("コーパスモードだけ応答一致を確認する", () => {
  assert.match(
    harness,
    /if \[\[ "\$MODE" == corpus \]\]; then[\s\S]*verify-echo\.js/u,
  );
});

test("探索モードは公開APIの補助拡張から自由なプロンプトを送る", () => {
  assert.match(
    harness,
    /if \[\[ "\$PI_FORMULA_VERIFY_MODE" == exploration \]\][\s\S]*pi "\$\{args\[@\]\}"/u,
  );
});

test("探索モードは明示した追加拡張を読み込む", () => {
  assert.match(
    harness,
    /PI_FORMULA_VERIFY_EXTRA_EXTENSIONS[\s\S]*args\+=\(--extension "\$extension"\)/u,
  );
});

test("探索モードは明示したツールだけを有効にする", () => {
  assert.match(
    harness,
    /PI_FORMULA_VERIFY_TOOLS[\s\S]*args\+=\(--tools "\$PI_FORMULA_VERIFY_TOOLS"\)/u,
  );
});

test("探索で得た応答をキャプチャ前にコーパスへ保存する", () => {
  assert.ok(
    markersAppearInOrder(
      harness,
      "save-display-response.js",
      "run_inside grim",
    ),
  );
});

test("探索モードは未完了を確認してからストリーミング画面を判定する", () => {
  assert.ok(
    markersAppearInOrder(
      harness,
      "stream_ready=false",
      'check-display-session.js" "$SESSION_FILE"',
      'run_inside grim "$STREAM_CAPTURE_FILE"',
      "detect-streaming-display-bands",
      'run touch "$STREAM_CAPTURE_ACK"',
    ),
  );
});

test("探索モードはストリーミング画面の後で確定画面も判定する", () => {
  assert.ok(
    markersAppearInOrder(
      harness,
      "detect-streaming-display-bands",
      'run touch "$STREAM_CAPTURE_ACK"',
      "completed=false",
      'run_inside grim "$CAPTURE_FILE"',
      "detector detect-display-bands",
    ),
  );
});

test("探索モードは二つの画面のどちらに帯があっても終了コード1にする", () => {
  assert.match(
    harness,
    /stream_detector_status" -eq 1 \|\| "\$detector_status" -eq 1/u,
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
      "run_inside grim",
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
      "run_inside grim",
      'verify-display-dimensions.js" png',
      "detect-display-bands.js",
    ),
  );
});

test("終了処理で検証セッションの process group を止める", () => {
  assert.match(harness, /kill -- "-\$CAGE_PID"/u);
});

test("順序判定は欠けた marker を拒否する", () => {
  assert.equal(markersAppearInOrder("first third", "first", "second"), false);
});

test("通常コマンドの失敗を実行基盤エラーへ正規化する", () => {
  assert.match(runFunction, /run-display-command" infrastructure "\$1"/u);
});

test("grim を時間上限付きの通常コマンドとして実行する", () => {
  assert.deepEqual(
    {
      runUsesTimeout: /run\(\).*timeout/su.test(harness),
      grimUsesRun: /^\s*run_inside grim/mu.test(harness),
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
