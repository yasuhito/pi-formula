import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";
import { longFormulaPlanFixture } from "../features/support/long-formula-plan.js";

const {
  planDisplay,
}: typeof import("../scripts/plan-display.js") = require("../scripts/plan-display.js");

const issueCorpus = path.resolve(
  __dirname,
  "../docs/agents/verify-corpus/issue-21.md",
);
const issue26Corpus = path.resolve(
  __dirname,
  "../docs/agents/verify-corpus/issue-26.md",
);

test("Issue 21 display formulas count toward image rows", () => {
  assert.ok(planDisplay(issueCorpus).imageRows > 0);
});

test("the Issue 21 corpus fits within the supported output height", () => {
  const { height } = planDisplay(issueCorpus);
  assert.ok(height >= 8000 && height <= 16000);
});

test("the three Issue 26 formulas with additional macros count toward image rows", () => {
  const plan = planDisplay(issue26Corpus);

  assert.deepEqual(
    { displayFormulas: plan.displayFormulas, hasImageRows: plan.imageRows > 0 },
    { displayFormulas: 3, hasImageRows: true },
  );
});

test("planning continues with only untypesettable display formulas falling back to the text path", () => {
  const corpus = ["$$x$$", "$$\\undefinedcommandhere$$"].join("\n\n");

  assert.deepEqual(planDisplay(corpus, { source: true }), {
    height: 8000,
    initialWidth: 1920,
    reflowWidth: null,
    imageRows: 1,
    displayFormulas: 2,
    failedFormulas: 1,
  });
});

test("text rows for untypesettable display formulas are added to output height only once", () => {
  const corpus = `${"本文\n".repeat(100)}$$\n\\undefinedcommandhere\n$$\n\n$$x$$`;

  assert.equal(planDisplay(corpus, { source: true }).height, 8224);
});

test("planning continues when display formulas exceeding the character limit fit the output height", () => {
  const { corpus, expectedPlan } = longFormulaPlanFixture();

  assert.deepEqual(planDisplay(corpus, { source: true }), expectedPlan);
});

test("the Issue 48 corpus includes full-width character widths in output height", () => {
  const issue48Corpus = path.resolve(
    __dirname,
    "../docs/agents/verify-corpus/issue-48.md",
  );

  assert.deepEqual(planDisplay(issue48Corpus), {
    height: 10760,
    initialWidth: 1920,
    reflowWidth: null,
    imageRows: 38,
    displayFormulas: 12,
    failedFormulas: 0,
  });
});

test("a corpus with multiple short but tall display formulas is rejected in advance", () => {
  const corpus = ["$$\\rule{1em}{300ex}$$", "$$\\rule{1em}{300ex}$$"].join(
    "\n\n",
  );

  assert.throws(() => planDisplay(corpus, { source: true }), /16000px/u);
});
