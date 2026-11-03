interface StepWorld {
  directory: string;
  planCorpus: string;
  expectedLongFormulaPlan: ReturnType<
    typeof longFormulaPlanFixture
  >["expectedPlan"];
  planResult: import("node:child_process").SpawnSyncReturns<string>;
}

const assert: typeof import("node:assert/strict") = require("node:assert/strict");
const fs: typeof import("node:fs") = require("node:fs");
const os: typeof import("node:os") = require("node:os");
const path: typeof import("node:path") = require("node:path");
const {
  spawnSync,
}: typeof import("node:child_process") = require("node:child_process");
const {
  Given,
  Then,
  When,
}: typeof import("@cucumber/cucumber") = require("@cucumber/cucumber");

const {
  longFormulaPlanFixture,
}: typeof import("../support/long-formula-plan.js") = require("../support/long-formula-plan.js");

const root = path.resolve(__dirname, "../..");

function createPlanCorpus(world: StepWorld, name: string, corpus: string) {
  world.directory = fs.mkdtempSync(
    path.join(os.tmpdir(), "pi-formula-cucumber-plan-"),
  );
  world.planCorpus = path.join(world.directory, name);
  fs.writeFileSync(world.planCorpus, corpus);
}

function runPlanBoundary(
  world: StepWorld,
  script: string,
  ...options: string[]
) {
  world.planResult = spawnSync(
    process.execPath,
    [path.join(root, `scripts/${script}`), ...options, world.planCorpus],
    { encoding: "utf8", timeout: 15_000 },
  );
  fs.rmSync(world.directory, { recursive: true, force: true });
}

Given(
  "a corpus contains formulas that can and cannot be typeset",
  function (this: StepWorld) {
    createPlanCorpus(
      this,
      "typesetting-failure.md",
      ["$$x$$", "$$\\undefinedcommandhere$$"].join("\n\n"),
    );
  },
);

Given(
  "a corpus contains only display math that cannot be typeset",
  function (this: StepWorld) {
    createPlanCorpus(
      this,
      "all-typesetting-failures.md",
      "$$\\undefinedcommandhere$$",
    );
  },
);

Given("an unreadable corpus path exists", function (this: StepWorld) {
  this.directory = fs.mkdtempSync(
    path.join(os.tmpdir(), "pi-formula-cucumber-plan-"),
  );
  this.planCorpus = path.join(this.directory, "missing.md");
});

Given(
  "a corpus wraps onto more lines when reflowed to 100 columns",
  function (this: StepWorld) {
    createPlanCorpus(this, "reflow.md", `${"あ".repeat(6_000)}\n\n$$x$$`);
  },
);

Given(
  "a corpus exceeds the limit only after reflow to 100 columns",
  function (this: StepWorld) {
    createPlanCorpus(
      this,
      "too-tall-after-reflow.md",
      `${"a".repeat(27_000)}\n\n$$x$$`,
    );
  },
);

Given(
  "a corpus contains a Markdown table with full-width characters and spaces",
  function (this: StepWorld) {
    const rows = ["| A | B |", "|---|---|"];
    for (let row = 0; row < 30; row += 1) {
      rows.push(`| ${"日本語".repeat(20)} | ${"word ".repeat(20)} |`);
    }
    createPlanCorpus(this, "table.md", `${rows.join("\n")}\n\n$$x$$`);
  },
);

Given(
  "display math becomes unreadably scaled at 100 columns",
  function (this: StepWorld) {
    const latex = Array.from({ length: 30 }, (_, index) => `x_${index}`).join(
      "+",
    );
    createPlanCorpus(this, "scaled.md", `$$${latex}$$`);
  },
);

Given("a corpus contains 11 tall display formulas", function (this: StepWorld) {
  const tallFormula = String.raw`$$\begin{matrix}x\\x\\x\\x\\x\\x\\x\\x\\x\\x\end{matrix}$$`;
  createPlanCorpus(
    this,
    "many-formulas.md",
    Array.from({ length: 11 }, () => tallFormula).join("\n"),
  );
});

Given(
  "a corpus that fits contains display math exceeding the character limit",
  function (this: StepWorld) {
    const { corpus, expectedPlan } = longFormulaPlanFixture();
    this.expectedLongFormulaPlan = expectedPlan;
    createPlanCorpus(this, "long-typesetting-failure.md", corpus);
  },
);

When(
  "run the real display verification display plan boundary",
  function (this: StepWorld) {
    runPlanBoundary(this, "verify-display-plan.js");
  },
);

When(
  "plan output height including display math image rows",
  function (this: StepWorld) {
    runPlanBoundary(this, "plan-display.js");
  },
);

When("run the text path display plan boundary", function (this: StepWorld) {
  runPlanBoundary(this, "verify-display-plan.js", "--path", "text");
});

When(
  "run the display plan boundary at 100 columns through the text path",
  function (this: StepWorld) {
    runPlanBoundary(
      this,
      "verify-display-plan.js",
      "--path",
      "text",
      "--reflow",
      "100",
    );
  },
);

When(
  "run the display plan boundary at 100 columns through the image path",
  function (this: StepWorld) {
    runPlanBoundary(this, "verify-display-plan.js", "--reflow", "100");
  },
);

Then(
  "The text display plan at 100 columns succeeds",
  function (this: StepWorld) {
    assert.deepEqual(this.planResult.status, 0);
  },
);

Then(
  "The planned height including reflow to 100 columns is 8856px",
  function (this: StepWorld) {
    const plan = JSON.parse(this.planResult.stdout);
    assert.deepEqual(plan.height, 8856);
  },
);

Then("The planned width before reflow is 1920px", function (this: StepWorld) {
  const plan = JSON.parse(this.planResult.stdout);
  assert.deepEqual(plan.initialWidth, 1920);
});

Then(
  "The planned width after reflow to 100 columns is 816px",
  function (this: StepWorld) {
    const plan = JSON.parse(this.planResult.stdout);
    assert.deepEqual(plan.reflowWidth, 816);
  },
);

Then(
  "A display plan that does not fit after reflow returns exit code 2",
  function (this: StepWorld) {
    assert.deepEqual(this.planResult.status, 2);
  },
);

Then(
  "Height overflow diagnostics show the text path",
  function (this: StepWorld) {
    assert.deepEqual(/テキスト経路/u.test(this.planResult.stderr), true);
  },
);

Then(
  "Height overflow diagnostics show reflow to 100 columns",
  function (this: StepWorld) {
    assert.deepEqual(/100列へのリフロー後/u.test(this.planResult.stderr), true);
  },
);

Then(
  "Height overflow diagnostics show the required height of 16056px",
  function (this: StepWorld) {
    assert.deepEqual(/16056px/u.test(this.planResult.stderr), true);
  },
);

Then(
  "The display plan includes Markdown table wrapping",
  function (this: StepWorld) {
    assert.equal(JSON.parse(this.planResult.stdout).height, 9000);
  },
);

Then(
  "The display plan containing unreadably scaled math succeeds",
  function (this: StepWorld) {
    assert.deepEqual(this.planResult.status, 0);
  },
);

Then(
  "Unreadably scaled math is planned as one typesetting failure",
  function (this: StepWorld) {
    assert.deepEqual(JSON.parse(this.planResult.stdout).failedFormulas, 1);
  },
);

Then(
  "Diagnostics show one typesetting failure for unreadably scaled math",
  function (this: StepWorld) {
    assert.deepEqual(
      /組版に失敗した表示数式: 1/u.test(this.planResult.stderr),
      true,
    );
  },
);

Then(
  "A display plan exceeding the height limit due to image transfer rows returns exit code 2",
  function (this: StepWorld) {
    assert.deepEqual(this.planResult.status, 2);
  },
);

Then(
  "Transfer row height overflow diagnostics show the image path",
  function (this: StepWorld) {
    assert.deepEqual(/画像経路/u.test(this.planResult.stderr), true);
  },
);

Then(
  "Transfer row height overflow diagnostics show the 16000px limit",
  function (this: StepWorld) {
    assert.deepEqual(/16000px/u.test(this.planResult.stderr), true);
  },
);

Then("The text path display plan succeeds", function (this: StepWorld) {
  assert.deepEqual(this.planResult.status, 0);
});

Then(
  "The text path display plan contains no image rows",
  function (this: StepWorld) {
    const plan = JSON.parse(this.planResult.stdout);
    assert.deepEqual(plan.imageRows, 0);
  },
);

Then(
  "The text path display plan contains no image typesetting failures",
  function (this: StepWorld) {
    const plan = JSON.parse(this.planResult.stdout);
    assert.deepEqual(plan.failedFormulas, 0);
  },
);

Then(
  "The verification display plan with typesetting failures succeeds",
  function (this: StepWorld) {
    assert.deepEqual(this.planResult.status, 0);
  },
);

Then(
  "The verification display plan counts one typesetting failure",
  function (this: StepWorld) {
    assert.deepEqual(JSON.parse(this.planResult.stdout).failedFormulas, 1);
  },
);

Then(
  "Verification display plan diagnostics show one typesetting failure",
  function (this: StepWorld) {
    assert.deepEqual(
      /組版に失敗した表示数式: 1/u.test(this.planResult.stderr),
      true,
    );
  },
);

Then(
  "The verification display plan without image rows succeeds",
  function (this: StepWorld) {
    assert.deepEqual(this.planResult.status, 0);
  },
);

Then(
  "A text display plan is returned even after all formulas fail typesetting",
  function (this: StepWorld) {
    assert.deepEqual(JSON.parse(this.planResult.stdout), {
      height: 8000,
      initialWidth: 1920,
      reflowWidth: null,
      imageRows: 0,
      displayFormulas: 1,
      failedFormulas: 1,
    });
  },
);

Then(
  "Diagnostics show one failure even after all formulas fail typesetting",
  function (this: StepWorld) {
    assert.deepEqual(
      /組版に失敗した表示数式: 1/u.test(this.planResult.stderr),
      true,
    );
  },
);

Then(
  "The unreadable corpus display plan returns exit code 2",
  function (this: StepWorld) {
    assert.deepEqual(this.planResult.status, 2);
  },
);

Then(
  "Display plan diagnostics show the unreadable corpus filename",
  function (this: StepWorld) {
    assert.deepEqual(/missing\.md/u.test(this.planResult.stderr), true);
  },
);

Then(
  "Read failure diagnostics do not show a height overflow",
  function (this: StepWorld) {
    assert.deepEqual(/16000px/u.test(this.planResult.stderr), false);
  },
);

Then(
  "Output height planning with typesetting failures succeeds",
  function (this: StepWorld) {
    assert.deepEqual(this.planResult.status, 0);
  },
);

Then(
  "A display plan containing typesetting failures and remaining image rows is returned",
  function (this: StepWorld) {
    assert.deepEqual(JSON.parse(this.planResult.stdout), {
      height: 8000,
      initialWidth: 1920,
      reflowWidth: null,
      imageRows: 1,
      displayFormulas: 2,
      failedFormulas: 1,
    });
  },
);

Then(
  "The display plan containing an input character limit failure succeeds",
  function (this: StepWorld) {
    assert.deepEqual(this.planResult.status, 0);
  },
);

Then(
  "A display plan counting long math as text exactly once is returned",
  function (this: StepWorld) {
    assert.deepEqual(
      JSON.parse(this.planResult.stdout),
      this.expectedLongFormulaPlan,
    );
  },
);

Given(
  "a short corpus contains display math taller than 16000px",
  function (this: StepWorld) {
    createPlanCorpus(
      this,
      "tall.md",
      ["$$\\rule{1em}{300ex}$$", "$$\\rule{1em}{300ex}$$"].join("\n\n"),
    );
  },
);

Then(
  "The tall display math plan returns exit code 2 before rendering",
  function (this: StepWorld) {
    assert.deepEqual(this.planResult.status, 2);
  },
);

Then(
  "Tall display math diagnostics show the 16000px limit",
  function (this: StepWorld) {
    assert.deepEqual(/16000px/u.test(this.planResult.stderr), true);
  },
);

Then(
  "Tall display math diagnostics do not show a read failure",
  function (this: StepWorld) {
    assert.deepEqual(/missing\.md/u.test(this.planResult.stderr), false);
  },
);
