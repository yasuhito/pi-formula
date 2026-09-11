const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const {
  NodeDisplayProcessAdapter,
} = require("../dist/display-verification-process.js");

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
      (error) => error.code === "ESRCH",
    );
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

test("direct childの終了後も同じprocess groupの子孫を停止する", async () => {
  const source = `
    const { spawn } = require("node:child_process");
    const child = spawn(process.execPath, ["-e", "process.on('SIGTERM', () => {}); setInterval(() => {}, 10000)"], { stdio: "inherit" });
    child.unref();
  `;
  const managed = adapter.spawn({
    label: "descendant",
    command: process.execPath,
    args: ["-e", source],
    timeoutMs: 10_000,
  });
  await new Promise((resolve) => setTimeout(resolve, 100));
  await managed.terminate();
  assert.throws(
    () => process.kill(-managed.pid, 0),
    (error) => error.code === "ESRCH",
  );
});
