const assert = require("node:assert/strict");
const path = require("node:path");
const test = require("node:test");
const { spawnSync } = require("node:child_process");

const wrapper = path.resolve(__dirname, "../scripts/run-display-command");

function run(mode, status) {
  return spawnSync(
    wrapper,
    [mode, process.execPath, "-e", `process.exit(${status})`],
    { encoding: "utf8" },
  );
}

test("準備コマンドの失敗を終了コード2へ正規化する", () => {
  const result = run("infrastructure", 1);
  assert.deepEqual(
    {
      status: result.status,
      reportsCause: /終了コード 1/u.test(result.stderr),
    },
    { status: 2, reportsCause: true },
  );
});

test("準備コマンドのtimeoutを終了コード2へ正規化する", () => {
  assert.equal(run("infrastructure", 124).status, 2);
});

test("ピクセル判定の帯検出だけは終了コード1を保つ", () => {
  assert.equal(run("detector", 1).status, 1);
});

test("ピクセル判定の実行失敗を終了コード2へ正規化する", () => {
  assert.equal(run("detector", 124).status, 2);
});
