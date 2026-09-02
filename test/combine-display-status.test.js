const assert = require("node:assert/strict");
const test = require("node:test");

const { combineDisplayStatuses } = require("../scripts/combine-display-status");

test("両方の判定器が正常なら終了コード0にする", () => {
  assert.equal(combineDisplayStatuses([0, 0]), 0);
});

test("判定器が実行できた場合だけ帯検出を終了コード1にする", () => {
  assert.equal(combineDisplayStatuses([1, 0]), 1);
});

test("探索中に帯があっても確定後の判定器失敗を終了コード2にする", () => {
  assert.equal(combineDisplayStatuses([1, 2]), 2);
});
