const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const { spawnSync } = require("node:child_process");

const verifier = path.resolve(__dirname, "../scripts/verify-image-path.js");

function verify(marker) {
  const directory = fs.mkdtempSync(
    path.join(os.tmpdir(), "pi-formula-image-path-"),
  );
  const filename = path.join(directory, "marker");
  if (marker !== undefined) fs.writeFileSync(filename, `${marker}\n`);
  const result = spawnSync(process.execPath, [verifier, filename], {
    encoding: "utf8",
  });
  fs.rmSync(directory, { recursive: true, force: true });
  return result;
}

test("画像経路の確認だけを受理する", () => {
  assert.equal(verify("image").status, 0);
});

test("PNG 問い合わせ失敗で選ばれたテキスト経路を拒否する", () => {
  const result = verify("text");
  assert.deepEqual(
    {
      status: result.status,
      reportsImagePath: /画像経路/u.test(result.stderr),
    },
    { status: 2, reportsImagePath: true },
  );
});

test("画像経路の確認記録がない場合を拒否する", () => {
  const result = verify(undefined);
  assert.deepEqual(
    {
      status: result.status,
      reportsImagePath: /画像経路/u.test(result.stderr),
    },
    { status: 2, reportsImagePath: true },
  );
});
