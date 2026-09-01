const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const { Given, Then, When } = require("@cucumber/cucumber");

const root = path.resolve(__dirname, "../..");
const checker = path.join(root, "scripts/verify-session-tools.js");
const regressionSession = path.join(
  root,
  "features/fixtures/session-tool-failure.jsonl",
);

function createSession(world, records) {
  world.directory = fs.mkdtempSync(
    path.join(os.tmpdir(), "pi-formula-session-record-"),
  );
  world.session = path.join(world.directory, "session.jsonl");
  fs.writeFileSync(
    world.session,
    `${records.map((record) => JSON.stringify(record)).join("\n")}\n`,
  );
}

function toolCall(id, name, args) {
  return {
    type: "message",
    message: {
      role: "assistant",
      content: [{ type: "toolCall", id, name, arguments: args }],
    },
  };
}

function toolResult(id, name, text, isError = false) {
  return {
    type: "message",
    message: {
      role: "toolResult",
      toolCallId: id,
      toolName: name,
      content: [{ type: "text", text }],
      isError,
    },
  };
}

function assistantText(text) {
  return {
    type: "message",
    message: {
      role: "assistant",
      content: [{ type: "text", text }],
    },
  };
}

Given(
  "`unsupported symbolic gate column` を含むセッション記録がある",
  function () {
    this.session = regressionSession;
  },
);

Given("失敗後にモデルが代替手段へ切り替えたセッション記録がある", function () {
  createSession(this, [
    toolCall("bash-call", "bash", { command: "qni run --symbolic" }),
    toolResult(
      "bash-call",
      "bash",
      "unsupported symbolic gate column\nCommand exited with code 1",
      true,
    ),
    assistantText(
      "シンボリック実行が対応していないので、代わりに数値で確認します。",
    ),
  ]);
});

Given("ツールが成功したセッション記録がある", function () {
  createSession(this, [
    toolCall("bash-call", "bash", { command: "printf ok" }),
    toolResult("bash-call", "bash", "ok"),
  ]);
});

Given(
  "成功したツールの後に「代わりに」を含む assistant 本文がある",
  function () {
    createSession(this, [
      toolCall("bash-call", "bash", { command: "printf ok" }),
      toolResult("bash-call", "bash", "ok"),
      assistantText("前の例の代わりに、別の正常な例を示します。"),
    ]);
  },
);

Given(
  "失敗後の次の assistant 本文には代替表現がなく後続本文に fallback がある",
  function () {
    createSession(this, [
      toolCall("bash-call", "bash", { command: "false" }),
      toolResult("bash-call", "bash", "Command exited with code 1", true),
      assistantText("失敗内容を確認します。"),
      assistantText("一般的な fallback の説明です。"),
    ]);
  },
);

Given("既知の機能不足を許容する無視リストがある", function () {
  this.session = regressionSession;
  this.directory = fs.mkdtempSync(
    path.join(os.tmpdir(), "pi-formula-session-ignore-"),
  );
  this.ignoreList = path.join(this.directory, "ignore-list.json");
  fs.writeFileSync(
    this.ignoreList,
    `${JSON.stringify(
      {
        ignore: [
          {
            kind: "機能不足",
            tool: "qni",
            command: "qni run --symbolic",
            pattern: "unsupported symbolic gate column",
          },
        ],
      },
      null,
      2,
    )}\n`,
  );
});

Given(
  /^`(kind|tool|command|pattern)` が空文字の無視リストがある$/u,
  function (field) {
    this.session = regressionSession;
    this.directory = fs.mkdtempSync(
      path.join(os.tmpdir(), "pi-formula-session-invalid-ignore-"),
    );
    this.ignoreList = path.join(this.directory, "ignore-list.json");
    fs.writeFileSync(
      this.ignoreList,
      `${JSON.stringify({ ignore: [{ [field]: "" }] })}\n`,
    );
  },
);

When("セッション記録検査を実行する", function () {
  this.result = spawnSync(process.execPath, [checker, this.session], {
    encoding: "utf8",
    timeout: 5_000,
  });
  if (this.directory)
    fs.rmSync(this.directory, { recursive: true, force: true });
});

When("無視リストを使ってセッション記録検査を実行する", function () {
  this.result = spawnSync(
    process.execPath,
    [checker, `--ignore=${this.ignoreList}`, this.session],
    { encoding: "utf8", timeout: 5_000 },
  );
  fs.rmSync(this.directory, { recursive: true, force: true });
});

Then("機能不足が qni の該当コマンドと文脈を伴って報告される", function () {
  assert.match(
    this.result.stdout,
    /種類: 機能不足[\s\S]*ツール: qni[\s\S]*コマンド: qni run --symbolic[\s\S]*文脈:[\s\S]*unsupported symbolic gate column/u,
  );
});

Then("qni の非 0 終了が該当コマンドとともに報告される", function () {
  assert.match(
    this.result.stdout,
    /種類: 非 0 終了[\s\S]*ツール: qni[\s\S]*コマンド: qni run --symbolic/u,
  );
});

Then("qni の途中停止が停止したコマンドとともに報告される", function () {
  assert.match(
    this.result.stdout,
    /種類: 途中停止[\s\S]*ツール: qni[\s\S]*コマンド: qni run --symbolic/u,
  );
});

Then(
  "代替手段への切り替えが直前のツールとコマンドを伴って報告される",
  function () {
    assert.match(
      this.result.stdout,
      /種類: 代替手段[\s\S]*ツール: bash[\s\S]*コマンド: qni run --symbolic/u,
    );
  },
);

Then("成功結果の後の代替表現は報告されない", function () {
  assert.doesNotMatch(this.result.stdout, /種類: 代替手段/u);
});

Then("失敗直後より後の代替表現は報告されない", function () {
  assert.doesNotMatch(this.result.stdout, /種類: 代替手段/u);
});

Then("セッション記録検査は終了コード1を返す", function () {
  assert.equal(this.result.status, 1);
});

Then("セッション記録は正常と判定される", function () {
  assert.deepEqual(
    { status: this.result.status, stdout: this.result.stdout },
    { status: 0, stdout: "セッション記録にツール失敗はありません\n" },
  );
});

Then("許容した機能不足だけが報告から除外される", function () {
  assert.doesNotMatch(this.result.stdout, /種類: 機能不足/u);
});

Then("無視対象外の非 0 終了が報告に残る", function () {
  assert.match(this.result.stdout, /種類: 非 0 終了/u);
});

Then("無視対象外のヒットにより終了コード1を返す", function () {
  assert.equal(this.result.status, 1);
});

Then("無効な無視リストとして終了コード2を返す", function () {
  assert.equal(this.result.status, 2);
});
