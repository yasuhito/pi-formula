const assert = require("node:assert/strict");
const path = require("node:path");
const test = require("node:test");
const { spawnSync } = require("node:child_process");

const wrapper = path.resolve(__dirname, "../scripts/run-display-command");
const label = "node-session-check";

function run(mode, status) {
  return spawnSync(
    wrapper,
    [mode, label, process.execPath, "-e", `process.exit(${status})`],
    { encoding: "utf8" },
  );
}

test("準備コマンドの失敗を実コマンド名付きの終了コード2へ正規化する", () => {
  const result = run("infrastructure", 1);
  assert.deepEqual(
    {
      status: result.status,
      reportsCause: /node-session-check.*終了コード 1/u.test(result.stderr),
    },
    { status: 2, reportsCause: true },
  );
});

test("準備コマンドのtimeoutを実コマンド名付きの終了コード2へ正規化する", () => {
  const result = run("infrastructure", 124);
  assert.deepEqual(
    {
      status: result.status,
      reportsCause: /node-session-check.*終了コード 124/u.test(result.stderr),
    },
    { status: 2, reportsCause: true },
  );
});

test("grimの無応答を打ち切って終了コード2へ正規化する", () => {
  const result = spawnSync(
    wrapper,
    ["infrastructure", "grim", "timeout", "0.05", "sleep", "1"],
    { encoding: "utf8", timeout: 1_000 },
  );
  assert.deepEqual(
    {
      status: result.status,
      reportsCause: /grim.*終了コード 124/u.test(result.stderr),
    },
    { status: 2, reportsCause: true },
  );
});

test("ピクセル判定の帯検出だけは終了コード1を保つ", () => {
  assert.equal(run("detector", 1).status, 1);
});

test("ピクセル判定の実行失敗を終了コード2へ正規化する", () => {
  assert.equal(run("detector", 124).status, 2);
});

test("セッションの未完了だけは終了コード1を保つ", () => {
  assert.equal(run("poll", 1).status, 1);
});

test("セッション検査の実行失敗を終了コード2へ正規化する", () => {
  assert.equal(run("poll", 2).status, 2);
});
