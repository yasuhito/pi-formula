interface StepWorld {
  closeLog: string;
  fakeCommandDirectory: string;
  precheckObservation: {
    error: string | null;
    status: number | null;
    signal: NodeJS.Signals | null;
    stdout: string;
    stderr: string;
    closedTerminals: string[];
  };
  terminalState: string | undefined;
}

const assert: typeof import("node:assert/strict") = require("node:assert/strict");
const {
  chmodSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
}: typeof import("node:fs") = require("node:fs");
const { tmpdir }: typeof import("node:os") = require("node:os");
const { join, resolve }: typeof import("node:path") = require("node:path");
const {
  spawnSync,
}: typeof import("node:child_process") = require("node:child_process");
const {
  After,
  Given,
  Then,
  When,
}: typeof import("@cucumber/cucumber") = require("@cucumber/cucumber");

const root = resolve(__dirname, "../..");
const prechecks: Record<string, string> = {
  "PR reviewer": "docs/agents/automations/pr-reviewer.precheck.sh",
  "issue coordinator": "docs/agents/automations/issue-coordinator.precheck.sh",
};
const terminalStates: Record<string, string> = {
  直近: "recent",
  "2分より前": "quiet",
  記録なし: "missing",
};

function writeExecutable(path: string, source: string) {
  writeFileSync(path, source);
  chmodSync(path, 0o755);
}

function prepareFakeCommands(world: StepWorld) {
  world.fakeCommandDirectory = mkdtempSync(
    join(tmpdir(), "pi-formula-precheck-"),
  );
  world.closeLog = join(world.fakeCommandDirectory, "terminal-close.log");

  writeExecutable(
    join(world.fakeCommandDirectory, "orca-ide"),
    `#!/usr/bin/env node
const fs = require("node:fs");
const args = process.argv.slice(2);
if (args[0] === "terminal" && args[1] === "list") {
  const terminal = { tabId: "worker-tab", handle: "worker-terminal" };
  if (process.env.FAKE_TERMINAL_STATE === "recent") terminal.lastOutputAt = Date.now();
  if (process.env.FAKE_TERMINAL_STATE === "quiet") terminal.lastOutputAt = Date.now() - 120001;
  console.log(JSON.stringify({ result: { terminals: [terminal] } }));
} else if (args[0] === "automations" && args[1] === "runs") {
  console.log(JSON.stringify({ result: { runs: [{ status: "completed", terminalSessionId: "worker-tab" }] } }));
} else if (args[0] === "terminal" && args[1] === "close") {
  fs.appendFileSync(process.env.CLOSE_LOG, args[3] + "\\n");
  console.log(JSON.stringify({ result: {} }));
} else {
  process.exitCode = 2;
}
`,
  );
  writeExecutable(
    join(world.fakeCommandDirectory, "gh"),
    `#!/usr/bin/env node
const args = process.argv.slice(2);
if (args[0] === "pr" && args[1] === "list") {
  console.log(JSON.stringify([{ number: 104, isDraft: false, labels: [{ name: "agent:review" }], statusCheckRollup: [], reviewRequests: [] }]));
} else if (args[0] === "issue" && args[1] === "list") {
  console.log(JSON.stringify([{ number: 103, labels: [{ name: "ready-for-agent" }, { name: "agent:implement" }] }]));
} else {
  process.exitCode = 2;
}
`,
  );
}

After(function (this: StepWorld) {
  if (this.fakeCommandDirectory) {
    rmSync(this.fakeCommandDirectory, { recursive: true, force: true });
  }
});

Given(
  /^terminal の最終出力が「(.+)」である$/,
  function (this: StepWorld, state: string) {
    prepareFakeCommands(this);
    this.terminalState = terminalStates[state];
  },
);

When(
  /^「(.+)」precheck を実行する$/,
  function (this: StepWorld, precheck: string) {
    const result = spawnSync("bash", [prechecks[precheck]], {
      cwd: root,
      encoding: "utf8",
      env: {
        ...process.env,
        PATH: `${this.fakeCommandDirectory}:${process.env.PATH}`,
        PI_FORMULA_REPO: root,
        CLOSE_LOG: this.closeLog,
        FAKE_TERMINAL_STATE: this.terminalState,
      },
    });
    const closedTerminals = readFileSync(this.closeLog, {
      encoding: "utf8",
      flag: "a+",
    })
      .trim()
      .split("\n")
      .filter(Boolean);
    this.precheckObservation = {
      error: result.error?.message ?? null,
      status: result.status,
      signal: result.signal,
      stdout: result.stdout,
      stderr: result.stderr,
      closedTerminals,
    };
  },
);

Then("precheckの子プロセス起動にエラーはない", function (this: StepWorld) {
  assert.equal(this.precheckObservation.error, null);
});

Then("precheckは終了コード0を返す", function (this: StepWorld) {
  assert.equal(this.precheckObservation.status, 0);
});

Then("precheckはシグナルで終了しない", function (this: StepWorld) {
  assert.equal(this.precheckObservation.signal, null);
});

Then("precheckは標準出力へ何も書かない", function (this: StepWorld) {
  assert.equal(this.precheckObservation.stdout, "");
});

Then("precheckは標準エラーへ何も書かない", function (this: StepWorld) {
  assert.equal(this.precheckObservation.stderr, "");
});

Then(
  "terminal closeは {string} だけ呼ばれる",
  function (this: StepWorld, expected: string) {
    assert.deepEqual(
      this.precheckObservation.closedTerminals,
      expected === "なし" ? [] : [expected],
    );
  },
);
