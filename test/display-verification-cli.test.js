const assert = require("node:assert/strict");
const path = require("node:path");
const test = require("node:test");
const { EventEmitter } = require("node:events");
const { spawnSync } = require("node:child_process");

const {
  runDisplayVerificationCli,
} = require("../dist/display-verification-cli.js");
const {
  NodeDisplayProcessAdapter,
} = require("../dist/display-verification-process.js");
const root = path.resolve(__dirname, "..");

function run(...args) {
  return spawnSync("npm", ["run", "verify:display", "--", ...args], {
    cwd: root,
    encoding: "utf8",
    timeout: 30_000,
  });
}

test("CLIは入力拒否を終了コード1で返す", () => {
  assert.equal(run().status, 1);
});

test("CLIはmachine-readableな入力拒否を一件返す", () => {
  assert.equal(JSON.parse(run().stdout).kind, "rejected");
});

async function runSignal(signalName) {
  const runtime = new EventEmitter();
  runtime.argv = [process.execPath, "verify-display.js"];
  runtime.stdout = { write() {} };
  runtime.stderr = { write() {} };
  const running = runDisplayVerificationCli(runtime, async (_args, signal) => {
    const outcome = await new NodeDisplayProcessAdapter().run(
      {
        label: "signal-integration",
        command: process.execPath,
        args: ["-e", "setTimeout(() => {}, 10000)"],
        timeoutMs: 10_000,
      },
      signal,
    );
    return {
      kind: "failed",
      stage: "cleanup",
      message: `process stopped with ${outcome.status}`,
    };
  });
  runtime.emit(signalName);
  await running;
  return runtime.exitCode;
}

for (const signal of ["SIGINT", "SIGTERM", "SIGHUP"]) {
  test(`${signal}は実表示検証を中断して終了コード2を返す`, async () => {
    assert.equal(await runSignal(signal), 2);
  });
}
