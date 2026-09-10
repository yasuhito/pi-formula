const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const { Given, Then, When } = require("@cucumber/cucumber");

const root = path.resolve(__dirname, "../..");

function createPlanCorpus(world, name, corpus) {
  world.directory = fs.mkdtempSync(
    path.join(os.tmpdir(), "pi-formula-cucumber-plan-"),
  );
  world.planCorpus = path.join(world.directory, name);
  fs.writeFileSync(world.planCorpus, corpus);
}

function runPlanBoundary(world, script, ...options) {
  world.planResult = spawnSync(
    process.execPath,
    [path.join(root, `scripts/${script}`), ...options, world.planCorpus],
    { encoding: "utf8", timeout: 15_000 },
  );
  fs.rmSync(world.directory, { recursive: true, force: true });
}

Given("組版できる式と組版できない式を含むコーパスがある", function () {
  createPlanCorpus(
    this,
    "typesetting-failure.md",
    ["$$x$$", "$$\\undefinedcommandhere$$"].join("\n\n"),
  );
});

Given("組版できない表示数式だけのコーパスがある", function () {
  createPlanCorpus(
    this,
    "all-typesetting-failures.md",
    "$$\\undefinedcommandhere$$",
  );
});

Given("読み取れないコーパスのパスがある", function () {
  this.directory = fs.mkdtempSync(
    path.join(os.tmpdir(), "pi-formula-cucumber-plan-"),
  );
  this.planCorpus = path.join(this.directory, "missing.md");
});

Given("100 列へのリフローで折り返しが増えるコーパスがある", function () {
  createPlanCorpus(this, "reflow.md", `${"あ".repeat(6_000)}\n\n$$x$$`);
});

Given("100 列へのリフロー後だけ上限を超えるコーパスがある", function () {
  createPlanCorpus(
    this,
    "too-tall-after-reflow.md",
    `${"a".repeat(27_000)}\n\n$$x$$`,
  );
});

Given("全角文字と空白を含む Markdown 表のコーパスがある", function () {
  const rows = ["| A | B |", "|---|---|"];
  for (let row = 0; row < 30; row += 1) {
    rows.push(`| ${"日本語".repeat(20)} | ${"word ".repeat(20)} |`);
  }
  createPlanCorpus(this, "table.md", `${rows.join("\n")}\n\n$$x$$`);
});

Given("100 列では読めない縮尺になる表示数式がある", function () {
  const latex = Array.from({ length: 30 }, (_, index) => `x_${index}`).join(
    "+",
  );
  createPlanCorpus(this, "scaled.md", `$$${latex}$$`);
});

Given("60 個の短い表示数式を含むコーパスがある", function () {
  createPlanCorpus(
    this,
    "many-formulas.md",
    Array.from({ length: 60 }, () => "$$x$$").join("\n"),
  );
});

Given("文字数上限を超える表示数式を含む収容可能なコーパスがある", function () {
  const tooLong = `x=${"x".repeat(16_383)}`;
  createPlanCorpus(
    this,
    "long-typesetting-failure.md",
    ["$$x$$", `$$${tooLong}$$`].join("\n\n"),
  );
});

When("実表示検証の表示計画境界を実行する", function () {
  runPlanBoundary(this, "verify-display-plan.js");
});

When("表示数式の画像行数を含む出力高を計画する", function () {
  runPlanBoundary(this, "plan-display.js");
});

When("テキスト経路の表示計画境界を実行する", function () {
  runPlanBoundary(this, "verify-display-plan.js", "--path", "text");
});

When("100 列とテキスト経路の表示計画境界を実行する", function () {
  runPlanBoundary(
    this,
    "verify-display-plan.js",
    "--path",
    "text",
    "--reflow",
    "100",
  );
});

When("100 列と画像経路の表示計画境界を実行する", function () {
  runPlanBoundary(this, "verify-display-plan.js", "--reflow", "100");
});

Then("表示計画は両方の描画が収まる寸法を返す", function () {
  const plan = JSON.parse(this.planResult.stdout);
  assert.deepEqual(
    {
      status: this.planResult.status,
      height: plan.height,
      initialWidth: plan.initialWidth,
      reflowWidth: plan.reflowWidth,
    },
    { status: 0, height: 8856, initialWidth: 1920, reflowWidth: 816 },
  );
});

Then("表示計画はリフロー幅と必要な高さを示して描画前に拒否する", function () {
  assert.deepEqual(
    {
      status: this.planResult.status,
      reportsPath: /テキスト経路/u.test(this.planResult.stderr),
      reportsReflow: /100列へのリフロー後/u.test(this.planResult.stderr),
      reportsRequiredHeight: /16056px/u.test(this.planResult.stderr),
    },
    {
      status: 2,
      reportsPath: true,
      reportsReflow: true,
      reportsRequiredHeight: true,
    },
  );
});

Then("表示計画は Markdown 表の折り返しを含む", function () {
  assert.equal(JSON.parse(this.planResult.stdout).height, 9000);
});

Then("表示計画は読めない縮尺を組版失敗として報告する", function () {
  assert.deepEqual(
    {
      status: this.planResult.status,
      failedFormulas: JSON.parse(this.planResult.stdout).failedFormulas,
      reportsFailures: /組版に失敗した表示数式: 1/u.test(
        this.planResult.stderr,
      ),
    },
    { status: 0, failedFormulas: 1, reportsFailures: true },
  );
});

Then("表示計画は画像転送行を含む高さ超過を報告する", function () {
  assert.deepEqual(
    {
      status: this.planResult.status,
      reportsPath: /画像経路/u.test(this.planResult.stderr),
      reportsLimit: /16000px/u.test(this.planResult.stderr),
    },
    { status: 2, reportsPath: true, reportsLimit: true },
  );
});

Then("表示計画は画像の組版結果を含まない", function () {
  const plan = JSON.parse(this.planResult.stdout);
  assert.deepEqual(
    {
      status: this.planResult.status,
      imageRows: plan.imageRows,
      failedFormulas: plan.failedFormulas,
    },
    { status: 0, imageRows: 0, failedFormulas: 0 },
  );
});

Then("verify-display は組版に失敗した表示数式の数を出す", function () {
  assert.deepEqual(
    {
      status: this.planResult.status,
      failedFormulas: JSON.parse(this.planResult.stdout).failedFormulas,
      reportsFailures: /組版に失敗した表示数式: 1/u.test(
        this.planResult.stderr,
      ),
    },
    { status: 0, failedFormulas: 1, reportsFailures: true },
  );
});

Then("画像行がなくても組版失敗を報告して計画を続ける", function () {
  assert.deepEqual(
    {
      status: this.planResult.status,
      plan: JSON.parse(this.planResult.stdout),
      reportsFailures: /組版に失敗した表示数式: 1/u.test(
        this.planResult.stderr,
      ),
    },
    {
      status: 0,
      plan: {
        height: 8000,
        initialWidth: 1920,
        reflowWidth: null,
        imageRows: 0,
        displayFormulas: 1,
        failedFormulas: 1,
      },
      reportsFailures: true,
    },
  );
});

Then("verify-display は高さ超過と決めつけず planner の理由を出す", function () {
  assert.deepEqual(
    {
      status: this.planResult.status,
      reportsMissing: /missing\.md/u.test(this.planResult.stderr),
      reportsLimit: /16000px/u.test(this.planResult.stderr),
    },
    { status: 2, reportsMissing: true, reportsLimit: false },
  );
});

Then("組版失敗を数えて残りの表示数式の計画を続ける", function () {
  assert.deepEqual(
    {
      status: this.planResult.status,
      plan: JSON.parse(this.planResult.stdout),
    },
    {
      status: 0,
      plan: {
        height: 8000,
        initialWidth: 1920,
        reflowWidth: null,
        imageRows: 1,
        displayFormulas: 2,
        failedFormulas: 1,
      },
    },
  );
});

Then("テキスト経路の行数を二重に数えず計画を続ける", function () {
  assert.deepEqual(
    {
      status: this.planResult.status,
      plan: JSON.parse(this.planResult.stdout),
    },
    {
      status: 0,
      plan: {
        height: 9856,
        initialWidth: 1920,
        reflowWidth: null,
        imageRows: 1,
        displayFormulas: 2,
        failedFormulas: 1,
      },
    },
  );
});

Given("16000px を超える高い表示数式を含む短いコーパスがある", function () {
  createPlanCorpus(
    this,
    "tall.md",
    ["$$\\rule{1em}{300ex}$$", "$$\\rule{1em}{300ex}$$"].join("\n\n"),
  );
});

Then("全履歴が収まらないコーパスは描画前に拒否される", function () {
  assert.deepEqual(
    {
      status: this.planResult.status,
      reportsLimit: /16000px/u.test(this.planResult.stderr),
      reportsOtherReason: /missing\.md/u.test(this.planResult.stderr),
    },
    { status: 2, reportsLimit: true, reportsOtherReason: false },
  );
});
