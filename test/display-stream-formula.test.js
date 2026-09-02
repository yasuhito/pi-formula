const assert = require("node:assert/strict");
const test = require("node:test");

const {
  advanceDisplayFormulaGate,
  findCompleteDisplayFormula,
} = require("../scripts/display-stream-formula");

function assistant(text) {
  return { role: "assistant", content: [{ type: "text", text }] };
}

test("表示数式より前の地の文では撮影ゲートを開始しない", () => {
  assert.deepEqual(
    advanceDisplayFormulaGate(undefined, assistant("説明します。")),
    {
      formulaToCapture: undefined,
      readyFormula: undefined,
    },
  );
});

test("完成した表示数式を見つけた更新は描画へ渡してから待つ", () => {
  assert.deepEqual(
    advanceDisplayFormulaGate(undefined, assistant("説明です。\n\n$$x^2$$")),
    { formulaToCapture: undefined, readyFormula: "$$x^2$$" },
  );
});

test("表示数式を描画へ渡した次の更新で同じ式の撮影を開始する", () => {
  assert.equal(
    advanceDisplayFormulaGate("$$x^2$$", assistant("説明です。\n\n$$x^2$$\n次"))
      .formulaToCapture,
    "$$x^2$$",
  );
});

test("コードフェンス内のドル記号を表示数式とみなさない", () => {
  assert.equal(findCompleteDisplayFormula("```text\n$$x^2$$\n```"), undefined);
});
