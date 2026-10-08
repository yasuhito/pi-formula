import assert from "node:assert/strict";
import {
  mkdirSync,
  mkdtempSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

const {
  commandsFromRealPi,
  isInside,
  PACKAGE_TRIAL_STEP_TIMEOUT_MS,
}: typeof import("./support/package-trial") = require("./support/package-trial");

test("package trial allows at least one minute for slow platform installs", () => {
  assert.equal(PACKAGE_TRIAL_STEP_TIMEOUT_MS >= 60_000, true);
});

test("temporary install check resolves directory aliases before comparing paths", () => {
  const temporary = mkdtempSync(join(tmpdir(), "pi-formula-path-alias-"));
  try {
    const actual = join(temporary, "actual");
    const alias = join(temporary, "alias");
    mkdirSync(actual);
    writeFileSync(join(actual, "api.js"), "");
    symlinkSync(actual, alias, "dir");

    assert.equal(isInside(alias, join(actual, "api.js")), true);
  } finally {
    rmSync(temporary, { recursive: true, force: true });
  }
});

test("Pi RPC startup failure returns diagnostics without hanging", {
  timeout: 2000,
}, async () => {
  const startedAt = Date.now();
  const result = await commandsFromRealPi(process.cwd(), process.env, {
    command: "missing-pi-formula-test-executable",
    responseTimeoutMs: 50,
    terminateTimeoutMs: 50,
    killTimeoutMs: 100,
  });

  assert.deepEqual(
    {
      failedToStart: /ENOENT/u.test(result.error ?? ""),
      hasResponse: result.response !== undefined,
      closed: result.closed,
      bounded: Date.now() - startedAt < 1000,
    },
    {
      failedToStart: true,
      hasResponse: false,
      closed: true,
      bounded: true,
    },
  );
});

test("Pi RPC escalates to SIGKILL when the child ignores SIGTERM", {
  timeout: 2000,
}, async () => {
  const startedAt = Date.now();
  const result = await commandsFromRealPi(process.cwd(), process.env, {
    command: process.execPath,
    args: [
      "--eval",
      "process.on('SIGTERM', () => {}); setInterval(() => {}, 1000)",
    ],
    responseTimeoutMs: 100,
    terminateTimeoutMs: 50,
    killTimeoutMs: 500,
  });

  assert.deepEqual(
    {
      responseTimedOut: result.responseTimedOut,
      sentSigterm: result.sentSigterm,
      sentSigkill: result.sentSigkill,
      closed: result.closed,
      bounded: Date.now() - startedAt < 1500,
    },
    {
      responseTimedOut: true,
      sentSigterm: true,
      sentSigkill: true,
      closed: true,
      bounded: true,
    },
  );
});
