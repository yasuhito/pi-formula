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

test("確定後だけ検査できた正常終了を終了コード3にする", () => {
  assert.equal(combineDisplayStatuses([0], true), 3);
});

test("確定後だけの検査でも帯検出を終了コード1にする", () => {
  assert.equal(combineDisplayStatuses([1], true), 1);
});
