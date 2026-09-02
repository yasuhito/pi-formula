const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const { Given, Then, When } = require("@cucumber/cucumber");

const { registerFormula } = require("../../dist/api.js");
const {
  advanceDisplayFormulaGate,
  findCompleteDisplayFormula,
  inspectTargetFormulaRendering,
  markTargetFormula,
  targetFitsViewport,
} = require("../../scripts/display-stream-formula");
const {
  DISPLAY_PROMPT_PREFIX,
  transformDisplayPrompt,
} = require("../../scripts/transform-display-prompt");
const {
  verifyStreamedFormula,
} = require("../../scripts/verify-streamed-formula");
const {
  combineDisplayStatuses,
} = require("../../scripts/combine-display-status");
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
  const markedFinal = markTargetFormula(
    this.partialResponses.at(-1),
    this.displayFormula,
  );
  this.finalTargetUsesImage = inspectTargetFormulaRendering(
    transform(markedFinal, false),
  ).renderedAsImage;
  this.harnessSequence = markersAppearInOrder(
    this.harness,
    "baseline_ready=false",
    'run touch "$BASELINE_CAPTURE_ACK"',
    "stream_ready=false",
    'run sleep "$CAPTURE_READY_INTERVAL"',
    'run kill -STOP "$stream_process_pid"',
    "stream_capture_deadline=",
    '"--different-from=$BASELINE_CAPTURE_FILE"',
    'run_inside grim "$STREAM_CAPTURE_FILE"',
    "check-streaming-display-rendered",
    "detect-streaming-display-bands",
    'run kill -CONT "$stream_process_pid"',
    'run touch "$STREAM_CAPTURE_ACK"',
    'if [[ "$MODE" == exploration && "$final_only" == false ]]',
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
        finalTargetUsesImage: this.finalTargetUsesImage,
        harnessSequence: this.harnessSequence,
      },
      {
        gatesBeforeFormula: [undefined, undefined, this.displayFormula],
        gatedFormula: this.displayFormula,
        streamingContainsFormula: true,
        streamingUsesImage: false,
        finalizedUsesImage: true,
        finalTargetUsesImage: true,
        harnessSequence: true,
      },
    );
  },
);

Given("表示数式が一度の更新で本文末尾に現れる探索応答がある", function () {
  this.singleUpdateFormula = "$$x^2+y^2=1$$";
});

When("その更新の撮影ゲートを調べる", function () {
  this.singleUpdateGate = advanceDisplayFormulaGate(undefined, {
    role: "assistant",
    content: [
      {
        type: "text",
        text: `説明です。\n\n${this.singleUpdateFormula}`,
      },
    ],
  }).formulaToCapture;
});

Then("次の更新を待たずに表示数式の撮影を開始する", function () {
  assert.equal(this.singleUpdateGate, this.singleUpdateFormula);
});

Given(
  /^未完了フレームを撮れない `([^`]+)` の探索応答がある$/u,
  function (reason) {
    this.finalOnlyReason = reason;
    this.harness = fs.readFileSync(
      path.join(root, "scripts/verify-display"),
      "utf8",
    );
    this.promptExtension = fs.readFileSync(
      path.join(root, "scripts/verify-extensions/pi-formula-verify-prompt.ts"),
      "utf8",
    );
  },
);

When("確定後だけ検査する終了を調べる", function () {
  const expectedReason =
    this.finalOnlyReason === "表示数式が現れなかった"
      ? "表示数式が現れませんでした"
      : "表示数式が確定と同時に現れました";
  const retryOptions = this.harness.slice(
    this.harness.indexOf(
      'run install -m 0644 "$CAPTURE_FILE" "$PREVIOUS_CAPTURE_FILE"',
      this.harness.indexOf(
        'if [[ "$MODE" == corpus || "$final_only" == true ]]',
      ),
    ),
    this.harness.indexOf(
      "done",
      this.harness.indexOf(
        'run install -m 0644 "$CAPTURE_FILE" "$PREVIOUS_CAPTURE_FILE"',
        this.harness.indexOf(
          'if [[ "$MODE" == corpus || "$final_only" == true ]]',
        ),
      ),
    ),
  );
  this.finalOnlyInspection = {
    keepsBaselineDifference:
      retryOptions.includes('if [[ "$final_only" == true ]]') &&
      retryOptions.includes(
        'rendered_options+=("--different-from=$BASELINE_CAPTURE_FILE")',
      ),
    reasonIsRecorded: this.promptExtension.includes(expectedReason),
    reportsFinalOnly: this.harness.includes("確定後のみ検査しました"),
    status: combineDisplayStatuses([0], true),
  };
});

Then(
  "撮影できなかった理由と確定後のみの検査を終了コード3で知らせる",
  function () {
    assert.deepEqual(this.finalOnlyInspection, {
      keepsBaselineDifference: true,
      reasonIsRecorded: true,
      reportsFinalOnly: true,
      status: 3,
    });
  },
);

Given(/^対象式が `([^`]+)` になる探索応答がある$/u, function (example) {
  if (example === "上限超過") {
    this.targetFormula = "$$\\rule{1em}{500ex}$$";
    this.streamingMarkdown = `説明です。\n\n${this.targetFormula}`;
    this.finalMarkdown = `${this.streamingMarkdown}\n\n$$y^2$$`;
  } else {
    this.targetFormula = "$$x^2$$";
    this.streamingMarkdown = `説明です。\n\n\`途中 ${this.targetFormula}`;
    this.finalMarkdown = `説明です。\n\n\`${this.targetFormula}\`\n\n$$y^2$$`;
  }
});

When("対象式の確定後の画像経路を調べる", async function () {
  const pi = fakePi();
  registerFormula(pi.api);
  await startWithKitty(pi);
  const marked = markTargetFormula(this.finalMarkdown, this.targetFormula);
  const rendered = pi.transformer()(marked, {
    messageType: "assistant",
    isStreaming: false,
    availableWidth: 80,
  });
  this.targetInspection = {
    detectedWhileStreaming:
      findCompleteDisplayFormula(this.streamingMarkdown) === this.targetFormula,
    anotherFormulaUsesImage: rendered.includes("\x1b_Ga=T,f=100"),
    targetUsesImage: inspectTargetFormulaRendering(rendered).renderedAsImage,
  };
});

Then("対象式が画像経路を通らない確定応答は検証不能にする", function () {
  assert.deepEqual(this.targetInspection, {
    detectedWhileStreaming: true,
    anotherFormulaUsesImage: true,
    targetUsesImage: false,
  });
});

Given(
  "表示数式の後に tool を使って別の回答を返す探索応答がある",
  async function () {
    this.directory = fs.mkdtempSync(
      path.join(os.tmpdir(), "pi-formula-cucumber-messages-"),
    );
    this.targetFormula = "$$x^2+y^2=1$$";
    this.firstAssistant = `計算します。\n\n${this.targetFormula}`;
    this.lastAssistant = "計算結果を確認しました。";
    this.explorationPi = fakePi();
    registerFormula(this.explorationPi.api);
    await startWithKitty(this.explorationPi);
  },
);

When("tool 前の対象式と tool 後の回答を検証する", function () {
  const transform = (markdown, isStreaming) =>
    this.explorationPi.transformer()(markdown, {
      messageType: "assistant",
      isStreaming,
      availableWidth: 80,
    });
  const streaming = transform(this.firstAssistant, true);
  const renderedTarget = transform(
    markTargetFormula(this.firstAssistant, this.targetFormula),
    false,
  );
  const targetInspection = inspectTargetFormulaRendering(renderedTarget);
  const laterInspection = inspectTargetFormulaRendering(
    transform(this.lastAssistant, false),
  );
  const session = path.join(this.directory, "session.jsonl");
  const marker = path.join(this.directory, "formula.md");
  const finalMarker = path.join(this.directory, "final-path.txt");
  const records = [
    {
      type: "message",
      message: {
        role: "assistant",
        stopReason: "toolUse",
        content: [{ type: "text", text: this.firstAssistant }],
      },
    },
    { type: "message", message: { role: "toolResult", content: [] } },
    {
      type: "message",
      message: {
        role: "assistant",
        stopReason: "stop",
        content: [{ type: "text", text: this.lastAssistant }],
      },
    },
  ];
  fs.writeFileSync(session, `${records.map(JSON.stringify).join("\n")}\n`);
  fs.writeFileSync(marker, this.targetFormula);
  fs.writeFileSync(finalMarker, "image\n");
  let accepted = true;
  try {
    verifyStreamedFormula(session, marker, finalMarker);
  } catch {
    accepted = false;
  }
  this.multiMessageInspection = {
    accepted,
    laterMessageHasNoTarget: !laterInspection.foundTarget,
    targetUsesImage: targetInspection.renderedAsImage,
    targetUsesTextWhileStreaming:
      streaming.includes(this.targetFormula) &&
      !streaming.includes("\x1b_Ga=T,f=100"),
  };
});

Then(
  "tool 前の同じ式のテキスト経路から画像経路への切り替えを受理する",
  function () {
    fs.rmSync(this.directory, { recursive: true, force: true });
    assert.deepEqual(this.multiMessageInspection, {
      accepted: true,
      laterMessageHasNoTarget: true,
      targetUsesImage: true,
      targetUsesTextWhileStreaming: true,
    });
  },
);

Given(
  "対象式の後に画面高を超える tool 出力と回答が続く探索応答がある",
  async function () {
    this.harness = fs.readFileSync(
      path.join(root, "scripts/verify-display"),
      "utf8",
    );
    this.promptExtension = fs.readFileSync(
      path.join(root, "scripts/verify-extensions/pi-formula-verify-prompt.ts"),
      "utf8",
    );
    this.followingOutput = "tool の長い出力\n".repeat(16_001);
    this.targetFormula = "$$x^2+y^2=1$$";
    this.explorationPi = fakePi();
    registerFormula(this.explorationPi.api);
    await startWithKitty(this.explorationPi);
  },
);

When("対象式の確定キャプチャと後続処理の順序を調べる", function () {
  const targetFrame = this.explorationPi.transformer()(
    markTargetFormula(
      `計算します。\n\n${this.targetFormula}`,
      this.targetFormula,
    ),
    { messageType: "assistant", isStreaming: false, availableWidth: 80 },
  );
  const targetRendering = inspectTargetFormulaRendering(targetFrame);
  const overflowViewport = this.followingOutput
    .split("\n")
    .slice(-16_000)
    .join("\n");
  this.finalCaptureInspection = {
    afterOverflowLosesTarget: !overflowViewport.includes(this.targetFormula),
    capturedTargetUsesImage: targetRendering.renderedAsImage,
    exceedsOutputHeight: this.followingOutput.split("\n").length > 16_000,
    extensionGate: markersAppearInOrder(
      this.promptExtension,
      'pi.on("tool_call"',
      "await waitForMarker(\n      finalMarker",
      'fs.writeFileSync(captureMarker, "ready\\n")',
      "await waitForMarker(\n      acknowledgement",
    ),
    harnessGate: markersAppearInOrder(
      this.harness,
      '[[ -s "$FINAL_CAPTURE_MARKER" ]]',
      'run sleep "$CAPTURE_READY_INTERVAL"',
      'run kill -STOP "$stream_process_pid"',
      '"--different-from=$STREAM_CAPTURE_FILE"',
      'run_inside grim "$CAPTURE_FILE"',
      "detector detect-display-bands",
      'run kill -CONT "$stream_process_pid"',
      'run touch "$FINAL_CAPTURE_ACK"',
      "for ((attempt = 0; attempt < SESSION_TIMEOUT; attempt += 1))",
    ),
  };
});

Then("長い後続出力を始める前に対象式の確定画面を判定する", function () {
  assert.deepEqual(this.finalCaptureInspection, {
    afterOverflowLosesTarget: true,
    capturedTargetUsesImage: true,
    exceedsOutputHeight: true,
    extensionGate: true,
    harnessGate: true,
  });
});

Given(
  "対象式の後に画面高を超える本文が同じ探索応答内で続く",
  async function () {
    this.targetFormula = "$$x^2+y^2=1$$";
    this.longFinalMarkdown = `${this.targetFormula}\n${"長い本文です。\n".repeat(1_001)}`;
    this.explorationPi = fakePi();
    registerFormula(this.explorationPi.api);
    await startWithKitty(this.explorationPi);
  },
);

When("対象式の確定画面への収まりを調べる", function () {
  const rendered = this.explorationPi.transformer()(
    markTargetFormula(this.longFinalMarkdown, this.targetFormula),
    { messageType: "assistant", isStreaming: false, availableWidth: 80 },
  );
  this.finalViewportInspection = {
    targetUsesImage: inspectTargetFormulaRendering(rendered).renderedAsImage,
    targetFitsViewport: targetFitsViewport(rendered, 80, 1_000),
  };
});

Then("画面外になる対象式の確定応答は検証不能にする", function () {
  assert.deepEqual(this.finalViewportInspection, {
    targetUsesImage: true,
    targetFitsViewport: false,
  });
});

When("tool 前の検査対象をコーパスファイルへ保存する", function () {
  const session = path.join(this.directory, "session.jsonl");
  const marker = path.join(this.directory, "formula.md");
  this.savedResponse = path.join(this.directory, "response.md");
  const messages = [
    {
      role: "assistant",
      stopReason: "toolUse",
      content: [{ type: "text", text: this.firstAssistant }],
    },
    { role: "toolResult", content: [] },
    {
      role: "assistant",
      stopReason: "stop",
      content: [{ type: "text", text: this.lastAssistant }],
    },
  ];
  fs.writeFileSync(
    session,
    `${messages
      .map((message) => JSON.stringify({ type: "message", message }))
      .join("\n")}\n`,
  );
  fs.writeFileSync(marker, this.targetFormula);
  this.saveResponseResult = spawnSync(
    process.execPath,
    [
      path.join(root, "scripts/save-display-response.js"),
      session,
      this.savedResponse,
      marker,
    ],
    { encoding: "utf8", timeout: 5_000 },
  );
});

Then("保存したコーパスに実表示検査した対象式が残る", function () {
  const saved =
    this.saveResponseResult.status === 0
      ? fs.readFileSync(this.savedResponse, "utf8")
      : this.saveResponseResult.stderr;
  fs.rmSync(this.directory, { recursive: true, force: true });
  assert.equal(saved, this.firstAssistant);
});

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
