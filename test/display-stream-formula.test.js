const assert = require("node:assert/strict");
const test = require("node:test");

const {
  advanceDisplayFormulaGate,
  findCompleteDisplayFormula,
  markTargetFormula,
  targetFitsViewport,
} = require("../scripts/display-stream-formula");

function assistant(text) {
  return { role: "assistant", content: [{ type: "text", text }] };
}

test("表示数式より前の地の文では撮影ゲートを開始しない", () => {
  assert.deepEqual(
    advanceDisplayFormulaGate(undefined, assistant("説明します。")),
    {
      formulaToCapture: undefined,
      hasReadyFormula: false,
      readyFormula: undefined,
    },
  );
});

test("完成した表示数式を見つけた更新で同じ式の撮影を開始する", () => {
  assert.deepEqual(
    advanceDisplayFormulaGate(undefined, assistant("説明です。\n\n$$x^2$$")),
    {
      formulaToCapture: "$$x^2$$",
      hasReadyFormula: true,
      readyFormula: "$$x^2$$",
    },
  );
});

test("表示数式を描画へ渡した次の更新でも同じ式の撮影を維持する", () => {
  assert.equal(
    advanceDisplayFormulaGate("$$x^2$$", assistant("説明です。\n\n$$x^2$$\n次"))
      .formulaToCapture,
    "$$x^2$$",
  );
});

test("対象式が確定messageの表示数式でなくなったことを識別する", () => {
  assert.equal(
    advanceDisplayFormulaGate("$$x^2$$", assistant("説明です。 `$$x^2$$`"))
      .hasReadyFormula,
    false,
  );
});

test("短い確定本文では対象式をキャプチャ内に保持できる", () => {
  const marked = markTargetFormula("$$x^2$$\n\n結論です。", "$$x^2$$");
  assert.equal(targetFitsViewport(marked, 80, 100), true);
});

test("対象式後の長い本文が画面高を超える場合は拒否する", () => {
  const marked = markTargetFormula(
    `$$x^2$$\n${"長い本文です。\n".repeat(1_001)}`,
    "$$x^2$$",
  );
  assert.equal(targetFitsViewport(marked, 80, 1_000), false);
});

test("コードフェンス内のドル記号を表示数式とみなさない", () => {
  assert.equal(findCompleteDisplayFormula("```text\n$$x^2$$\n```"), undefined);
});
