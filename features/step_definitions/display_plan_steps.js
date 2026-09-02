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

function runPlanBoundary(world, script) {
  world.planResult = spawnSync(
    process.execPath,
    [path.join(root, `scripts/${script}`), world.planCorpus],
    { encoding: "utf8", timeout: 5_000 },
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

Given("読み取れないコーパスのパスがある", function () {
  this.directory = fs.mkdtempSync(
    path.join(os.tmpdir(), "pi-formula-cucumber-plan-"),
  );
  this.planCorpus = path.join(this.directory, "missing.md");
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
        height: 9712,
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
