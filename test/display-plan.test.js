const assert = require("node:assert/strict");
const path = require("node:path");
const test = require("node:test");

const { planDisplay } = require("../scripts/plan-display.js");

const issueCorpus = path.resolve(
  __dirname,
  "../docs/agents/verify-corpus/issue-21.md",
);
const issue26Corpus = path.resolve(
  __dirname,
  "../docs/agents/verify-corpus/issue-26.md",
);

test("Issue 21 の表示数式を画像行数として数える", () => {
  assert.ok(planDisplay(issueCorpus).imageRows > 0);
});

test("Issue 21 のコーパスを対応する出力高へ収める", () => {
  const { height } = planDisplay(issueCorpus);
  assert.ok(height >= 8000 && height <= 16000);
});

test("Issue 26 の追加マクロを含む3式を画像行数として数える", () => {
  const plan = planDisplay(issue26Corpus);

  assert.deepEqual(
    { displayFormulas: plan.displayFormulas, hasImageRows: plan.imageRows > 0 },
    { displayFormulas: 3, hasImageRows: true },
  );
});

test("組版できない表示数式だけをテキスト経路へ戻して計画を続ける", () => {
  const corpus = ["$$x$$", "$$\\undefinedcommandhere$$"].join("\n\n");

  assert.deepEqual(planDisplay(corpus, { source: true }), {
    height: 8000,
    imageRows: 1,
    displayFormulas: 2,
    failedFormulas: 1,
  });
});

test("組版できない表示数式のテキスト行を出力高へ一度だけ加える", () => {
  const corpus = `${"本文\n".repeat(100)}$$\n\\undefinedcommandhere\n$$\n\n$$x$$`;

  assert.equal(planDisplay(corpus, { source: true }).height, 8080);
});

test("文字数上限を超える表示数式の出力高が収まれば計画を続ける", () => {
  const tooLong = `x=${"x".repeat(16_383)}`;
  const corpus = ["$$x$$", `$$${tooLong}$$`].join("\n\n");

  assert.deepEqual(planDisplay(corpus, { source: true }), {
    height: 9712,
    imageRows: 1,
    displayFormulas: 2,
    failedFormulas: 1,
  });
});

test("既存の Issue 48 コーパスの計画結果を変えない", () => {
  const issue48Corpus = path.resolve(
    __dirname,
    "../docs/agents/verify-corpus/issue-48.md",
  );

  assert.deepEqual(planDisplay(issue48Corpus), {
    height: 9176,
    imageRows: 38,
    displayFormulas: 12,
    failedFormulas: 0,
  });
});

test("短いが高い表示数式を複数含むコーパスを事前に拒否する", () => {
  const corpus = ["$$\\rule{1em}{300ex}$$", "$$\\rule{1em}{300ex}$$"].join(
    "\n\n",
  );

  assert.throws(() => planDisplay(corpus, { source: true }), /16000px/u);
});
