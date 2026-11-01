import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { EventEmitter } from "node:events";
import path from "node:path";
import test from "node:test";

const {
  runDisplayVerificationCli,
}: typeof import("../dist/display-verification-cli.js") = require("../dist/display-verification-cli.js");

import { NodeDisplayProcessAdapter } from "../dist/display-verification-process.js";

const root = path.resolve(__dirname, "..");

// npm run verify:display は dist/ を消して再ビルドするため、並列に走る
// 他のテストファイルが dist/ を require できなくなる。ビルド済みの
// スクリプトを直接起動する。
function run(...args: string[]) {
  return spawnSync(
    process.execPath,
    [path.join(root, "scripts", "verify-display.js"), ...args],
    {
      cwd: root,
      encoding: "utf8",
      timeout: 30_000,
    },
  );
}

test("CLIは入力拒否を終了コード1で返す", () => {
  assert.equal(run().status, 1);
});

test("CLIはmachine-readableな入力拒否を一件返す", () => {
  assert.equal(JSON.parse(run().stdout).kind, "rejected");
});

async function runSignal(signalName: NodeJS.Signals) {
  const runtime = Object.assign(new EventEmitter(), {
    argv: [process.execPath, "verify-display.js"],
    stdout: { write() {} },
    stderr: { write() {} },
    exitCode: undefined as number | undefined,
  });
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

for (const signal of ["SIGINT", "SIGTERM", "SIGHUP"] as const) {
  test(`${signal}は実表示検証を中断して終了コード2を返す`, async () => {
    assert.equal(await runSignal(signal), 2);
  });
}
