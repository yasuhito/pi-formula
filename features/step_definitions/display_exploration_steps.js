const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const { Given, Then, When } = require("@cucumber/cucumber");

const { registerFormula } = require("../../dist/api.js");
const {
  advanceDisplayFormulaGate,
} = require("../../scripts/display-stream-formula");
const {
  DISPLAY_PROMPT_PREFIX,
  transformDisplayPrompt,
} = require("../../scripts/transform-display-prompt");
const { fakePi, startWithKitty } = require("../../test/support/fake-pi");
const root = path.resolve(__dirname, "../..");

function markersAppearInOrder(source, ...markers) {
  let previous = -1;
  for (const marker of markers) {
    const position = source.indexOf(marker, previous + 1);
    if (position < 0) return false;
    previous = position;
  }
  return true;
}

Given(
  "地の文の後に表示数式と後続本文を生成する探索ハーネスがある",
  async function () {
    this.harness = fs.readFileSync(
      path.join(root, "scripts/verify-display"),
      "utf8",
    );
    this.explorationPi = fakePi();
    registerFormula(this.explorationPi.api);
    await startWithKitty(this.explorationPi);
    this.displayFormula = "$$x^2+y^2=1$$";
    this.partialResponses = [
      "説明します。",
      "説明します。まず前提です。",
      `説明します。まず前提です。\n\n${this.displayFormula}`,
      `説明します。まず前提です。\n\n${this.displayFormula}\n\nこの式を使います。`,
    ];
  },
);

When("同じ表示数式の探索中と確定後の描画経路を調べる", function () {
  let readyFormula;
  this.gateDecisions = this.partialResponses.map((markdown) => {
    const decision = advanceDisplayFormulaGate(readyFormula, {
      role: "assistant",
      content: [{ type: "text", text: markdown }],
    });
    readyFormula = decision.readyFormula;
    return decision.formulaToCapture;
  });
  const transform = (markdown, isStreaming) =>
    this.explorationPi.transformer()(markdown, {
      messageType: "assistant",
      isStreaming,
      availableWidth: 80,
    });
  this.streamingFrame = transform(this.partialResponses.at(-2), true);
  this.finalizedFrame = transform(this.partialResponses.at(-1), false);
  this.harnessSequence = markersAppearInOrder(
    this.harness,
    "stream_ready=false",
    'run_inside grim "$STREAM_CAPTURE_FILE"',
    "detect-streaming-display-bands",
    'run touch "$STREAM_CAPTURE_ACK"',
    "completed=false",
    "verify-streamed-formula.js",
    'run_inside grim "$CAPTURE_FILE"',
    "detector detect-display-bands",
  );
});

Then(
  "早い地の文では止まらず同じ表示数式をテキスト経路と画像経路で検査する",
  function () {
    assert.deepEqual(
      {
        gatesBeforeFormula: this.gateDecisions.slice(0, 3),
        gatedFormula: this.gateDecisions.at(-1),
        streamingContainsFormula: this.streamingFrame.includes(
          this.displayFormula,
        ),
        streamingUsesImage: this.streamingFrame.includes("\x1b_Ga=T,f=100"),
        finalizedUsesImage: this.finalizedFrame.includes("\x1b_Ga=T,f=100"),
        harnessSequence: this.harnessSequence,
      },
      {
        gatesBeforeFormula: [undefined, undefined, undefined],
        gatedFormula: this.displayFormula,
        streamingContainsFormula: true,
        streamingUsesImage: false,
        finalizedUsesImage: true,
        harnessSequence: true,
      },
    );
  },
);

Given("qni-math の描画 entry point を指定した探索コマンドがある", function () {
  this.verifyDisplayArguments = [
    "--prompt",
    "表示数式を説明してください。",
    "--extension",
    "/opt/qni-cli/dist/qni-math/index.js",
    "--tools",
    "qni",
  ];
});

Then("二つ目の数式描画を読み込む前に拒否する", function () {
  assert.deepEqual(
    {
      status: this.verifyDisplayResult.status,
      stderr: this.verifyDisplayResult.stderr,
    },
    {
      status: 2,
      stderr:
        "verify-display: qni-math の描画 entry point は pi-formula と同時に読み込めません\n",
    },
  );
});

Given(/^`([^`]+)` という探索用プロンプトがある$/u, function (prompt) {
  this.explorationPrompt = prompt;
});

When("公開 API で探索用プロンプトを送る", function () {
  const transformed = transformDisplayPrompt(
    `${DISPLAY_PROMPT_PREFIX}${this.explorationPrompt}`,
  );
  this.sentPrompt = transformed?.text;
});

Then(
  /^CLI 記法と解釈せず `([^`]+)` と一字一句同じ user message を送る$/u,
  function (prompt) {
    assert.equal(this.sentPrompt, prompt);
  },
);

Given("未対応の引数を持つ実表示検証コマンドがある", function () {
  this.verifyDisplayArguments = [
    path.join(root, "docs/agents/verify-corpus/issue-21.md"),
    "--unknown",
  ];
});

When("実表示検証コマンドを実行する", function () {
  this.verifyDisplayResult = spawnSync(
    path.join(root, "scripts/verify-display"),
    this.verifyDisplayArguments,
    { encoding: "utf8", timeout: 5_000 },
  );
});

Then("エラー本文と Usage を stderr の別の行へ表示する", function () {
  assert.match(
    this.verifyDisplayResult.stderr,
    /^verify-display: 未対応の引数です: --unknown\nUsage:/u,
  );
});

Given("探索で得た完了済みの応答がある", function () {
  this.directory = fs.mkdtempSync(
    path.join(os.tmpdir(), "pi-formula-cucumber-response-"),
  );
  this.savedResponse = path.join(this.directory, "response.md");
  this.explorationResponse = "説明です。\n\n$$\\frac{1}{2}$$";
  this.explorationSession = path.join(this.directory, "session.jsonl");
  fs.writeFileSync(
    this.explorationSession,
    `${JSON.stringify({
      type: "message",
      message: {
        role: "assistant",
        stopReason: "stop",
        content: [{ type: "text", text: this.explorationResponse }],
      },
    })}\n`,
  );
});

When("応答をコーパスファイルへ保存する", function () {
  this.saveResponseResult = spawnSync(
    process.execPath,
    [
      path.join(root, "scripts/save-display-response.js"),
      this.explorationSession,
      this.savedResponse,
    ],
    { encoding: "utf8", timeout: 5_000 },
  );
});

Then("保存したコーパスは応答と一字一句一致する", function () {
  const actual =
    this.saveResponseResult.status === 0
      ? fs.readFileSync(this.savedResponse, "utf8")
      : this.saveResponseResult.stderr;
  fs.rmSync(this.directory, { recursive: true, force: true });
  assert.equal(actual, this.explorationResponse);
});
