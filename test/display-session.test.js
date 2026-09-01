const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const { spawnSync } = require("node:child_process");

const checker = path.resolve(__dirname, "../scripts/check-display-session.js");

function check(content) {
  const directory = fs.mkdtempSync(
    path.join(os.tmpdir(), "pi-formula-session-"),
  );
  const filename = path.join(directory, "session.jsonl");
  if (content !== undefined) fs.writeFileSync(filename, content);
  const result = spawnSync(process.execPath, [checker, filename], {
    encoding: "utf8",
  });
  fs.rmSync(directory, { recursive: true, force: true });
  return result;
}

test("未作成のセッション記録を未完了として無言で待つ", () => {
  const result = check(undefined);
  assert.deepEqual(
    { status: result.status, stderr: result.stderr },
    { status: 1, stderr: "" },
  );
});

test("未完了のセッション記録を終了コード1で待つ", () => {
  assert.equal(check('{"type":"session"}\n').status, 1);
});

test("完了したassistant応答を終了コード0で受理する", () => {
  const record = {
    type: "message",
    message: { role: "assistant", stopReason: "stop" },
  };
  assert.equal(check(`${JSON.stringify(record)}\n`).status, 0);
});

test("壊れたJSONLを終了コード2で即時拒否する", () => {
  assert.equal(check("{broken}\n").status, 2);
});
