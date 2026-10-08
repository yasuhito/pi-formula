import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

const {
  NodeDisplayProcessAdapter,
}: typeof import("../dist/display-verification-process.js") = require("../dist/display-verification-process.js");

const adapter = new NodeDisplayProcessAdapter();

test("production process adapterは標準出力を返す", async () => {
  const outcome = await adapter.run({
    label: "output",
    command: process.execPath,
    args: ["-e", 'process.stdout.write("ready")'],
    timeoutMs: 1_000,
  });
  assert.equal(outcome.stdout, "ready");
});

test("production process adapterは期限を超えたprocessを停止する", async () => {
  const outcome = await adapter.run({
    label: "timeout",
    command: process.execPath,
    args: ["-e", "setTimeout(() => {}, 10_000)"],
    timeoutMs: 20,
  });
  assert.equal(outcome.timedOut, true);
});

test("timeout後にprocessが終了コード0を返しても失敗にする", async () => {
  const outcome = await adapter.run({
    label: "handled-timeout",
    command: process.execPath,
    args: [
      "-e",
      "process.on('SIGTERM', () => process.exit(0)); setInterval(() => {}, 10000)",
    ],
    timeoutMs: 50,
  });
  assert.equal(outcome.status, 2);
});

test("開始前に中断済みならprocessを直ちに停止する", async () => {
  const controller = new AbortController();
  controller.abort();
  const outcome = await adapter.run(
    {
      label: "already-aborted",
      command: process.execPath,
      args: ["-e", "setTimeout(() => {}, 10_000)"],
      timeoutMs: 10_000,
    },
    controller.signal,
  );
  assert.notEqual(outcome.status, 0);
});

test("AbortSignalはprocessを停止する", async () => {
  const controller = new AbortController();
  const pending = adapter.run(
    {
      label: "abort",
      command: process.execPath,
      args: ["-e", "setTimeout(() => {}, 10_000)"],
      timeoutMs: 10_000,
    },
    controller.signal,
  );
  controller.abort();
  assert.notEqual((await pending).status, 0);
});

test("managed processは明示的に停止できる", async () => {
  const managed = adapter.spawn({
    label: "managed",
    command: process.execPath,
    args: ["-e", "setTimeout(() => {}, 10_000)"],
    timeoutMs: 10_000,
  });
  const diagnostics = await managed.terminate();
  assert.deepEqual(diagnostics, []);
});

test("run commandの異常終了時も子孫processを停止する", async () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "display-process-"));
  const pidFile = path.join(directory, "child.pid");
  const source = `
    const { spawn } = require("node:child_process");
    const child = spawn(process.execPath, ["-e", "process.on('SIGTERM', () => {}); setInterval(() => {}, 10000)"], { stdio: "ignore" });
    require("node:fs").writeFileSync(${JSON.stringify(pidFile)}, String(child.pid));
    child.unref();
    process.exit(2);
  `;
  try {
    await adapter.run({
      label: "failed-descendant",
      command: process.execPath,
      args: ["-e", source],
      timeoutMs: 10_000,
    });
    const pid = Number(fs.readFileSync(pidFile, "utf8"));
    assert.throws(
      () => process.kill(pid, 0),
      (error: unknown) =>
        error instanceof Error && "code" in error && error.code === "ESRCH",
    );
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

test("direct childの終了後も同じprocess groupの子孫を停止する", async () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "display-process-"));
  const pidFile = path.join(directory, "ready.pid");
  const stateOf = (pid: number) => {
    const result = spawnSync("ps", ["-p", String(pid), "-o", "stat="], {
      encoding: "utf8",
    });
    if (result.error) throw result.error;
    if (result.status === 1 && result.stdout.trim() === "") return "absent";
    if (result.status !== 0) throw new Error(`ps failed: ${result.stderr}`);
    return result.stdout.trim();
  };
  const stopped = (state: string) =>
    state === "absent" || state.startsWith("Z");
  const descendant = `
    process.on("SIGTERM", () => {});
    setInterval(() => {}, 10000);
    require("node:fs").writeFileSync(${JSON.stringify(pidFile)}, String(process.pid));
  `;
  const source = `
    const { spawn } = require("node:child_process");
    const child = spawn(process.execPath, ["-e", ${JSON.stringify(descendant)}], { stdio: "inherit" });
    child.unref();
  `;
  const managed = adapter.spawn({
    label: "descendant",
    command: process.execPath,
    args: ["-e", source],
    timeoutMs: 10_000,
  });
  let descendantPid: number | undefined;
  try {
    const deadline = Date.now() + 5_000;
    while (!fs.existsSync(pidFile) || !stopped(stateOf(managed.pid))) {
      if (Date.now() >= deadline)
        throw new Error("descendant did not become ready");
      await new Promise((resolve) => setTimeout(resolve, 20));
    }
    descendantPid = Number(fs.readFileSync(pidFile, "utf8"));
    if (stopped(stateOf(descendantPid))) {
      throw new Error("descendant exited before termination was requested");
    }
    await managed.terminate();
    // ps also distinguishes an exited, unreaped child from a running child on macOS.
    assert.match(stateOf(descendantPid), /^(?:absent|Z\S*)$/);
  } finally {
    await managed.terminate("SIGKILL");
    if (descendantPid && !stopped(stateOf(descendantPid))) {
      process.kill(descendantPid, "SIGKILL");
    }
    await managed.completion;
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

test("停止後にprocess groupへの探査がEPERMを返してもabortは完了する", async () => {
  const originalKill = process.kill;
  const terminated = new Set();
  process.kill = (pid, signal) => {
    if (pid < 0 && signal === "SIGTERM") terminated.add(pid);
    if (pid < 0 && signal === 0 && terminated.has(pid)) {
      const error = Object.assign(new Error("kill EPERM"), { code: "EPERM" });
      throw error;
    }
    return originalKill.call(process, pid, signal);
  };
  try {
    const controller = new AbortController();
    const pending = adapter.run(
      {
        label: "eperm-probe",
        command: process.execPath,
        args: ["-e", "setTimeout(() => {}, 10_000)"],
        timeoutMs: 10_000,
      },
      controller.signal,
    );
    controller.abort();
    assert.equal((await pending).status, 2);
  } finally {
    process.kill = originalKill;
  }
});
