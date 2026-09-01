const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const { Given, Then, When } = require("@cucumber/cucumber");

const { createPng } = require("../../test/support/png-fixture");
const { planDisplay } = require("../../scripts/plan-display");
const root = path.resolve(__dirname, "../..");

function normalDisplay(x, y) {
  if (y >= 8 && y <= 13 && x >= 8 && x <= 111) return [230, 228, 217];
  if (y === 28 && x >= 18 && x <= 101) return [40, 40, 35];
  if (y >= 35 && y <= 45 && x >= 25 && x < 95 && (x + y) % 11 < 2)
    return [40, 40, 35];
  return [250, 248, 240];
}

Given("実表示検証ハーネスと Issue 21 の再現コーパスがある", function () {
  this.harness = fs.readFileSync(
    path.join(root, "scripts/verify-display"),
    "utf8",
  );
  this.corpus = fs.readFileSync(
    path.join(root, "docs/agents/verify-corpus/issue-21.md"),
    "utf8",
  );
  this.macrosExtension = fs.readFileSync(
    path.join(root, "scripts/verify-extensions/pi-formula-verify-macros.ts"),
    "utf8",
  );
});

When("ハーネスの安全条件を調べる", function () {
  this.safety = {
    headless: /output create headless/u.test(this.harness),
    tallOutput:
      /plan-display\.js/u.test(this.harness) && /grim -o/u.test(this.harness),
    launchRule:
      /workspace = .* silent/u.test(this.harness) &&
      /monitor = .* silent/u.test(this.harness) &&
      /no_initial_focus = true/u.test(this.harness),
    timeouts:
      /run\(\).*timeout/su.test(this.harness) &&
      /PI_FORMULA_VERIFY_WINDOW_LIFETIME/u.test(this.harness),
    focusGuard: /AFTER_FOCUS.*BEFORE_FOCUS/su.test(this.harness),
    isolatedExtension:
      /--no-extensions/u.test(this.harness) &&
      /--extension "\$PI_FORMULA_VERIFY_EXTENSION"/u.test(this.harness) &&
      /src\/extension\.ts/u.test(this.harness),
    isolatedSettings:
      /XDG_CONFIG_HOME="\$PI_FORMULA_VERIFY_CONFIG_HOME"/u.test(this.harness) &&
      /PI_FORMULA_MACROS='\{\}'/u.test(this.harness),
    windowCapture:
      /verify-display-window[^\n]*[\s\S]*"\$window_address" "1920" "\$HEIGHT"/u.test(
        this.harness,
      ) &&
      /grim -o "\$OUTPUT_NAME" "\$OUTPUT_CAPTURE_FILE"/u.test(this.harness) &&
      /crop-display-capture\.js/u.test(this.harness),
    lockGuard:
      /check-display-lock/u.test(this.harness) &&
      this.harness.indexOf("check-display-lock") <
        this.harness.indexOf("output create headless"),
    captureTimeout:
      /run\(\).*timeout/su.test(this.harness) &&
      /run grim -o/u.test(this.harness) &&
      /run-display-command[\s\S]*exit 2/u.test(
        fs.readFileSync(path.join(root, "scripts/run-display-command"), "utf8"),
      ),
    captureReadyRetry:
      /capture_deadline=\$\(\(SECONDS \+ CAPTURE_READY_TIMEOUT\)\)/u.test(
        this.harness,
      ) &&
      /run-display-command" poll check-display-rendered/u.test(this.harness) &&
      /--previous=\$PREVIOUS_CAPTURE_FILE/u.test(this.harness) &&
      /Ghostty の描画完了をキャプチャで確認できませんでした/u.test(
        this.harness,
      ),
    additionalMacros:
      /--extension "\$PI_FORMULA_VERIFY_MACROS_EXTENSION"/u.test(
        this.harness,
      ) &&
      /from "\.\.\/\.\.\/src\/api"/u.test(this.macrosExtension) &&
      /registerFormula\(pi, VERIFY_DISPLAY_MACROS\)/u.test(
        this.macrosExtension,
      ),
    keptCapture:
      /CAPTURE_DESTINATION=\$\{PI_FORMULA_VERIFY_CAPTURE:-/u.test(
        this.harness,
      ) &&
      /printf 'キャプチャ: %s\\n' "\$CAPTURE_DESTINATION"/u.test(
        this.harness,
      ) &&
      /キャプチャを開いて表示を確認してください/u.test(this.harness),
    imagePath: /verify-image-path\.js/u.test(this.harness),
    capturedImage: /check-display-rendered\.js/u.test(this.harness),
    exactEcho: /verify-echo\.js/u.test(this.harness),
    cleanup:
      /trap cleanup EXIT INT TERM HUP/u.test(this.harness) &&
      /setsid timeout/u.test(this.harness) &&
      /cleanup-display/u.test(this.harness),
  };
});

Then("検証専用の headless 出力を作成する", function () {
  assert.equal(this.safety.headless, true);
});

Then("計画した全履歴を1枚で取得する", function () {
  assert.equal(this.safety.tallOutput, true);
});

Then("検証ウィンドウを headless 出力へフォーカスなしで起動する", function () {
  assert.equal(this.safety.launchRule, true);
});

Then("外部処理と検証ウィンドウへ時間上限を設ける", function () {
  assert.equal(this.safety.timeouts, true);
});

Then("起動後も可視画面のフォーカスが変わらないことを確認する", function () {
  assert.equal(this.safety.focusGuard, true);
});

Then("利用者の拡張を除外して現在の pi-formula を読み込む", function () {
  assert.equal(this.safety.isolatedExtension, true);
});

Then("一時設定と空の利用者マクロを使う", function () {
  assert.equal(this.safety.isolatedSettings, true);
});

Then("headless 出力の検証ウィンドウ矩形だけをキャプチャする", function () {
  assert.equal(this.safety.windowCapture, true);
});

Then("描画前に画面ロック状態を確認する", function () {
  assert.equal(this.safety.lockGuard, true);
});

Then("キャプチャへ時間上限と検証不能の終了コードを使う", function () {
  assert.equal(this.safety.captureTimeout, true);
});

Then("前回のキャプチャと一致するまで実時間の期限内で撮り直す", function () {
  assert.equal(this.safety.captureReadyRetry, true);
});

Then("公開 API で追加マクロを登録する拡張を読み込む", function () {
  assert.equal(this.safety.additionalMacros, true);
});

Then("キャプチャ前に画像経路を確認する", function () {
  assert.equal(this.safety.imagePath, true);
});

Then("保存先の指定がなくてもキャプチャを残して報告する", function () {
  assert.equal(this.safety.keptCapture, true);
});

Then("ピクセル判定前に描画完了を確認する", function () {
  assert.equal(this.safety.capturedImage, true);
});

Then("キャプチャ前に応答一致を確認する", function () {
  assert.equal(this.safety.exactEcho, true);
});

Then("失敗時も process group と headless 出力を後片付けする", function () {
  assert.equal(this.safety.cleanup, true);
});

Then("Issue 21 の最後の表示数式がコーパスに含まれる", function () {
  assert.ok(this.corpus.includes("F_8"));
});

Given("Issue 26 の再現コーパスがある", function () {
  this.corpus = fs.readFileSync(
    path.join(root, "docs/agents/verify-corpus/issue-26.md"),
    "utf8",
  );
});

Then("追加マクロを含む3つの表示数式を組版できる", function () {
  const plan = planDisplay(this.corpus, { source: true });
  assert.deepEqual(
    { displayFormulas: plan.displayFormulas, hasImageRows: plan.imageRows > 0 },
    { displayFormulas: 3, hasImageRows: true },
  );
});

Given("16000px を超える高い表示数式を含む短いコーパスがある", function () {
  this.directory = fs.mkdtempSync(
    path.join(os.tmpdir(), "pi-formula-cucumber-plan-"),
  );
  this.tallCorpus = path.join(this.directory, "tall.md");
  fs.writeFileSync(
    this.tallCorpus,
    ["$$\\rule{1em}{300ex}$$", "$$\\rule{1em}{300ex}$$"].join("\n\n"),
  );
});

When("表示数式の画像行数を含む出力高を計画する", function () {
  this.planResult = spawnSync(
    process.execPath,
    [path.join(root, "scripts/plan-display.js"), this.tallCorpus],
    { encoding: "utf8", timeout: 5_000 },
  );
  fs.rmSync(this.directory, { recursive: true, force: true });
});

Then("全履歴が収まらないコーパスは描画前に拒否される", function () {
  assert.deepEqual(
    {
      status: this.planResult.status,
      reportsLimit: /16000px/u.test(this.planResult.stderr),
    },
    { status: 2, reportsLimit: true },
  );
});

Given(
  /^コーパスへ `([^`]+)` を加えた assistant のセッション記録がある$/u,
  function (change) {
    this.directory = fs.mkdtempSync(
      path.join(os.tmpdir(), "pi-formula-cucumber-echo-"),
    );
    this.echoCorpus = path.join(this.directory, "corpus.md");
    this.echoSession = path.join(this.directory, "session.jsonl");
    const corpus = "本文 $x$。\n\n$$\n\\frac{1}{2}\n$$";
    const changed = {
      コードフェンス: `\`\`\`markdown\n${corpus}\n\`\`\``,
      "Unicode 化": corpus.replace("\\frac{1}{2}", "½"),
      前置き: `原文です。\n${corpus}`,
      欠落: corpus.replace("本文 $x$。\n\n", ""),
    }[change];
    fs.writeFileSync(this.echoCorpus, corpus);
    fs.writeFileSync(
      this.echoSession,
      `${JSON.stringify({
        type: "message",
        message: {
          role: "assistant",
          stopReason: "stop",
          content: [{ type: "text", text: changed }],
        },
      })}\n`,
    );
  },
);

When("応答とコーパスの一致を検証する", function () {
  this.echoResult = spawnSync(
    process.execPath,
    [
      path.join(root, "scripts/verify-echo.js"),
      this.echoCorpus,
      this.echoSession,
    ],
    { encoding: "utf8", timeout: 5_000 },
  );
  fs.rmSync(this.directory, { recursive: true, force: true });
});

Then("改変された応答はキャプチャ前に拒否される", function () {
  assert.deepEqual(
    {
      status: this.echoResult.status,
      reportsMismatch: /一字一句一致しません/u.test(this.echoResult.stderr),
    },
    { status: 2, reportsMismatch: true },
  );
});

function givenPng(world, withBand) {
  world.directory = fs.mkdtempSync(
    path.join(os.tmpdir(), "pi-formula-cucumber-band-"),
  );
  world.capture = path.join(world.directory, "capture.png");
  fs.writeFileSync(
    world.capture,
    createPng(120, 80, (x, y) => {
      if (withBand && y >= 36 && y <= 43 && x >= 18 && x <= 105)
        return [210, 0, 170];
      return normalDisplay(x, y);
    }),
  );
}

Given("帯のない表示数式の合成 PNG がある", function () {
  givenPng(this, false);
});

Given("ID 色の水平帯がある表示数式の合成 PNG がある", function () {
  givenPng(this, true);
});

When("ピクセル判定を実行する", function () {
  this.result = spawnSync(
    process.execPath,
    [
      path.join(root, "scripts/detect-display-bands.js"),
      "--background=250,248,240",
      "--body=40,40,35",
      "--ignore=230,228,217",
      this.capture,
    ],
    { encoding: "utf8", timeout: 5_000 },
  );
  fs.rmSync(this.directory, { recursive: true, force: true });
});

Then("表示数式のキャプチャは正常と判定される", function () {
  assert.deepEqual(
    {
      status: this.result.status,
      reportsNoBands: /異常な水平帯はありません/u.test(this.result.stdout),
    },
    { status: 0, reportsNoBands: true },
  );
});

Then("水平帯の座標が報告される", function () {
  assert.deepEqual(
    {
      status: this.result.status,
      reportsCoordinates: /x=18\.\.105, y=36\.\.43/u.test(this.result.stdout),
    },
    { status: 1, reportsCoordinates: true },
  );
});
