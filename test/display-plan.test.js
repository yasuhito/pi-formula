const assert = require("node:assert/strict");
const path = require("node:path");
const test = require("node:test");

const { planDisplay } = require("../scripts/plan-display.js");

const issueCorpus = path.resolve(
  __dirname,
  "../docs/agents/verify-corpus/issue-21.md",
);

test("Issue 21 の表示数式を画像行数込みで縦長出力へ収める", () => {
  const plan = planDisplay(issueCorpus);

  assert.ok(plan.imageRows > 0);
  assert.ok(plan.height >= 8000 && plan.height <= 16000);
});

test("短いが高い表示数式を複数含むコーパスを事前に拒否する", () => {
  const corpus = ["$$\\rule{1em}{300ex}$$", "$$\\rule{1em}{300ex}$$"].join(
    "\n\n",
  );

  assert.throws(() => planDisplay(corpus, { source: true }), /16000px/u);
});
