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

function runBuiltScriptDirectly(...args: string[]) {
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

test("the CLI returns exit code 1 for input rejection", () => {
  assert.equal(runBuiltScriptDirectly().status, 1);
});

test("the CLI returns one machine-readable input rejection", () => {
  assert.equal(JSON.parse(runBuiltScriptDirectly().stdout).kind, "rejected");
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
  test(`${signal} aborts real-display verification with exit code 2`, async () => {
    assert.equal(await runSignal(signal), 2);
  });
}
