const assert = require("node:assert/strict");
const test = require("node:test");

const { selectFormulaSerifFamily } = require("../dist/system-font.js");

test("表示数式のセリフ体は実在する候補を優先順に選ぶ", () => {
  const selected = selectFormulaSerifFamily([
    "/fonts/ipaexm.ttf",
    "/fonts/SourceHanSerifJP-Regular.otf",
    "/fonts/NotoSerifCJK-Regular.ttc",
  ]);

  assert.equal(selected, "Noto Serif CJK JP");
});

test("表示数式の各セリフ体候補を実在するファイルから選ぶ", () => {
  const selected = [
    ["/fonts/SourceHanSerifJP-Regular.otf"],
    ["/fonts/SourceHanSerif-Regular.otf"],
    ["/fonts/ipaexm.ttf"],
  ].map(selectFormulaSerifFamily);

  assert.deepEqual(selected, [
    "Source Han Serif JP",
    "Source Han Serif",
    "IPAexMincho",
  ]);
});

test("CJK対応セリフ体が無い場合はシステムのセリフ体へ戻る", () => {
  const selected = selectFormulaSerifFamily([
    "/fonts/LiberationSerif-Regular.ttf",
  ]);

  assert.equal(selected, undefined);
});
