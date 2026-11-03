interface StepWorld {
  directory: string;
  ignoreList: string;
  result: import("node:child_process").SpawnSyncReturns<string>;
  session: string;
}

const assert: typeof import("node:assert/strict") = require("node:assert/strict");
const fs: typeof import("node:fs") = require("node:fs");
const os: typeof import("node:os") = require("node:os");
const path: typeof import("node:path") = require("node:path");
const {
  spawnSync,
}: typeof import("node:child_process") = require("node:child_process");
const {
  Given,
  Then,
  When,
}: typeof import("@cucumber/cucumber") = require("@cucumber/cucumber");

const root = path.resolve(__dirname, "../..");
const checker = path.join(root, "scripts/verify-session-tools.js");
const regressionSession = path.join(
  root,
  "features/fixtures/session-tool-failure.jsonl",
);

function createSession(world: StepWorld, records: unknown[]) {
  world.directory = fs.mkdtempSync(
    path.join(os.tmpdir(), "pi-formula-session-record-"),
  );
  world.session = path.join(world.directory, "session.jsonl");
  fs.writeFileSync(
    world.session,
    `${records.map((record) => JSON.stringify(record)).join("\n")}\n`,
  );
}

function toolCall(id: string, name: string, args: unknown) {
  return {
    type: "message",
    message: {
      role: "assistant",
      content: [{ type: "toolCall", id, name, arguments: args }],
    },
  };
}

function toolResult(id: string, name: string, text: string, isError = false) {
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

function assistantText(text: string) {
  return {
    type: "message",
    message: {
      role: "assistant",
      content: [{ type: "text", text }],
    },
  };
}

Given(
  "a session record contains `unsupported symbolic gate column`",
  function (this: StepWorld) {
    this.session = regressionSession;
  },
);

Given(
  "a session record has a runner capability limitation in a single check command",
  function (this: StepWorld) {
    createSession(this, [
      toolCall("runner-call", "runner", { commands: [["check"]] }),
      toolResult("runner-call", "runner", "unsupported check"),
    ]);
  },
);

Given(
  "a session record has an interruption in the second runner deploy command",
  function (this: StepWorld) {
    createSession(this, [
      toolCall("runner-call", "runner", {
        commands: [["check"], ["deploy"]],
      }),
      toolResult("runner-call", "runner", "Stopped at command 2 of 2.", true),
    ]);
  },
);

Given(
  "a session record has the model switch to a fallback after failure",
  function (this: StepWorld) {
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
  },
);

Given(
  "a session record has a successful tool result",
  function (this: StepWorld) {
    createSession(this, [
      toolCall("bash-call", "bash", { command: "printf ok" }),
      toolResult("bash-call", "bash", "ok"),
    ]);
  },
);

Given(
  "an assistant body contains 「代わりに」 after a successful tool result",
  function (this: StepWorld) {
    createSession(this, [
      toolCall("bash-call", "bash", { command: "printf ok" }),
      toolResult("bash-call", "bash", "ok"),
      assistantText("前の例の代わりに、別の正常な例を示します。"),
    ]);
  },
);

Given(
  "the next assistant body after failure has no fallback wording but a later body mentions fallback",
  function (this: StepWorld) {
    createSession(this, [
      toolCall("bash-call", "bash", { command: "false" }),
      toolResult("bash-call", "bash", "Command exited with code 1", true),
      assistantText("失敗内容を確認します。"),
      assistantText("一般的な fallback の説明です。"),
    ]);
  },
);

Given(
  "an ignore list allows known capability limitations",
  function (this: StepWorld) {
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
              kind: "unsupported",
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
  },
);

Given(
  /^an ignore list has an empty `(kind|tool|command|pattern)` field$/u,
  function (this: StepWorld, field: string) {
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

When("run the session record check", function (this: StepWorld) {
  this.result = spawnSync(process.execPath, [checker, this.session], {
    encoding: "utf8",
    timeout: 5_000,
  });
  if (this.directory)
    fs.rmSync(this.directory, { recursive: true, force: true });
});

When(
  "run the session record check with the ignore list",
  function (this: StepWorld) {
    this.result = spawnSync(
      process.execPath,
      [checker, `--ignore=${this.ignoreList}`, this.session],
      { encoding: "utf8", timeout: 5_000 },
    );
    fs.rmSync(this.directory, { recursive: true, force: true });
  },
);

Then(
  "The capability limitation is reported with the corresponding qni command and context",
  function (this: StepWorld) {
    assert.match(
      this.result.stdout,
      /Kind: unsupported[\s\S]*Tool: qni[\s\S]*Command: qni run --symbolic[\s\S]*Context:[\s\S]*unsupported symbolic gate column/u,
    );
  },
);

Then(
  "The nonzero qni exit is reported with the corresponding command",
  function (this: StepWorld) {
    assert.match(
      this.result.stdout,
      /Kind: nonzero-exit[\s\S]*Tool: qni[\s\S]*Command: qni run --symbolic/u,
    );
  },
);

Then(
  "The interrupted qni execution is reported with the interrupted command",
  function (this: StepWorld) {
    assert.match(
      this.result.stdout,
      /Kind: stopped[\s\S]*Tool: qni[\s\S]*Command: qni run --symbolic/u,
    );
  },
);

Then(
  "The capability-limited command is reported as runner check",
  function (this: StepWorld) {
    assert.match(
      this.result.stdout,
      /Kind: unsupported[\s\S]*Tool: runner[\s\S]*Command: runner check/u,
    );
  },
);

Then(
  "The interrupted command is reported as runner deploy",
  function (this: StepWorld) {
    assert.match(
      this.result.stdout,
      /Kind: stopped[\s\S]*Tool: runner[\s\S]*Command: runner deploy/u,
    );
  },
);

Then(
  "The fallback is reported with the preceding tool and command",
  function (this: StepWorld) {
    assert.match(
      this.result.stdout,
      /Kind: fallback suggested[\s\S]*Tool: bash[\s\S]*Command: qni run --symbolic/u,
    );
  },
);

Then(
  "Alternative wording after a successful result is not reported",
  function (this: StepWorld) {
    assert.doesNotMatch(this.result.stdout, /Kind: fallback suggested/u);
  },
);

Then(
  "Fallback wording later than the immediate failure response is not reported",
  function (this: StepWorld) {
    assert.doesNotMatch(this.result.stdout, /Kind: fallback suggested/u);
  },
);

Then(
  "The session record check returns exit code 1",
  function (this: StepWorld) {
    assert.equal(this.result.status, 1);
  },
);

Then(
  "The successful session record check returns exit code 0",
  function (this: StepWorld) {
    assert.deepEqual(this.result.status, 0);
  },
);

Then(
  "A successful session record reports no tool failures",
  function (this: StepWorld) {
    assert.deepEqual(
      this.result.stdout,
      "No tool failures in session record\n",
    );
  },
);

Then(
  "Only allowed capability limitations are excluded from the report",
  function (this: StepWorld) {
    assert.doesNotMatch(this.result.stdout, /Kind: unsupported/u);
  },
);

Then(
  "Nonzero exits outside the ignore list remain in the report",
  function (this: StepWorld) {
    assert.match(this.result.stdout, /Kind: nonzero-exit/u);
  },
);

Then(
  "Matches outside the ignore list return exit code 1",
  function (this: StepWorld) {
    assert.equal(this.result.status, 1);
  },
);

Then("The invalid ignore list returns exit code 2", function (this: StepWorld) {
  assert.equal(this.result.status, 2);
});
