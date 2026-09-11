const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { After, Given, Then, When } = require("@cucumber/cucumber");

const { planDisplay } = require("../../scripts/plan-display");
const { expandFormulaMacros } = require("../../dist/macros");
const {
  extractQniCliAdditionalMacros,
  readQniCliAdditionalMacros,
} = require("../../scripts/qni-cli-additional-macros");
const {
  createDisplayVerificationFixture,
} = require("../../test/support/display-verification-fixture.js");
const root = path.resolve(__dirname, "../..");

After(function () {
  if (this.displayFixture) this.displayFixture.cleanup();
  else if (this.directory)
    fs.rmSync(this.directory, { recursive: true, force: true });
});

Given("実行可能な実表示検証の試験環境がある", function () {
  this.displayFixture = createDisplayVerificationFixture();
  this.directory = this.displayFixture.directory;
  this.processAdapter = this.displayFixture.processAdapter;
});

Given("応答がコーパスと異なる", function () {
  this.processAdapter.options.response = "$$y$$\n";
});

Given("100 列へ描き直す", function () {
  this.displayFixture.options.reflow = 100;
  this.processAdapter.options.plan = {
    height: 80,
    initialWidth: 120,
    reflowWidth: 80,
    imageRows: 1,
    displayFormulas: 1,
    failedFormulas: 0,
  };
});

When("実表示検証の interface を実行する", async function () {
  this.displayResult = await this.displayFixture.run();
});

Then("目視確認用のキャプチャを返す", function () {
  assert.equal(this.displayResult.kind, "captured");
});

Then("応答確認 stage の失敗を返す", function () {
  assert.equal(this.displayResult.stage, "verify-response");
});

Then("変更前後のキャプチャを返す", function () {
  assert.equal(this.displayResult.captures?.length, 2);
});

Given("Issue 21 の再現コーパスがある", function () {
  this.corpus = fs.readFileSync(
    path.join(root, "docs/agents/verify-corpus/issue-21.md"),
    "utf8",
  );
});

Then("Issue 21 の最後の表示数式がコーパスに含まれる", function () {
  assert.ok(this.corpus.includes("F_8"));
});

Given("Issue 26 の再現コーパスがある", function () {
  this.corpus = fs.readFileSync(
    path.join(root, "docs/agents/verify-corpus/issue-26.md"),
    "utf8",
  );
});

Then("追加マクロを含む3つの表示数式を組版できる", function () {
  const plan = planDisplay(this.corpus, { source: true });
  assert.deepEqual(
    { displayFormulas: plan.displayFormulas, hasImageRows: plan.imageRows > 0 },
    { displayFormulas: 3, hasImageRows: true },
  );
});

Given("Issue 48 の Grover コーパスがある", function () {
  this.corpus = fs.readFileSync(
    path.join(root, "docs/agents/verify-corpus/issue-48.md"),
    "utf8",
  );
});

Then("bra と braket を含む表示数式を組版できる", function () {
  assert.ok(planDisplay(this.corpus, { source: true }).imageRows > 0);
});

Given("braket の直後に ket が続く表示数式がある", function () {
  this.formula = String.raw`\braket{s|\psi} - \ket{\psi}`;
});

Then("braket と直後の ket は別の項へ展開される", function () {
  assert.equal(
    expandFormulaMacros(
      this.formula,
      require("../../scripts/verify-display-macros.js").VERIFY_DISPLAY_MACROS,
    ),
    String.raw`\left\langle{}s|\psi\right\rangle - \left|\psi\right\rangle`,
  );
});

Given("bra を使う表示数式がある", function () {
  this.formula = String.raw`\bra{\psi}`;
});

Then("bra は山括弧と縦線へ展開される", function () {
  assert.equal(
    expandFormulaMacros(
      this.formula,
      require("../../scripts/verify-display-macros.js").VERIFY_DISPLAY_MACROS,
    ),
    String.raw`\left\langle\psi\right|`,
  );
});

Given("ket を使う表示数式がある", function () {
  this.formula = String.raw`\ket{\psi}`;
});

Then("ket は縦線と山括弧へ展開される", function () {
  assert.equal(
    expandFormulaMacros(
      this.formula,
      require("../../scripts/verify-display-macros.js").VERIFY_DISPLAY_MACROS,
    ),
    String.raw`\left|\psi\right\rangle`,
  );
});

Given("Issue 52 の幅掃引コーパスがある", function () {
  this.corpus = fs.readFileSync(
    path.join(root, "docs/agents/verify-corpus/issue-52.md"),
    "utf8",
  );
});

Then("項数3から15までの7つの表示数式を組版できる", function () {
  const plan = planDisplay(this.corpus, { source: true });
  assert.deepEqual(
    {
      displayFormulas: plan.displayFormulas,
      startsAtThree: this.corpus.includes("x_1 + x_2 + x_3 = 0"),
      endsAtFifteen: this.corpus.includes("x_{14} + x_{15} = 0"),
    },
    { displayFormulas: 7, startsAtThree: true, endsAtFifteen: true },
  );
});

function setMacroDefinitions(world, qniCliSource) {
  world.verifyDisplayMacros =
    require("../../scripts/verify-display-macros.js").VERIFY_DISPLAY_MACROS;
  world.qniCliMacros = extractQniCliAdditionalMacros(
    qniCliSource,
    "qni-cli-quantum-macros.ts",
  );
}

Given(
  "検証ハーネスと書式だけが異なる qni-cli の追加マクロ定義がある",
  function () {
    const sourcePath =
      process.env.QNI_CLI_MACROS ??
      path.join(root, "features/fixtures/qni-cli-quantum-macros.ts");
    this.verifyDisplayMacros =
      require("../../scripts/verify-display-macros.js").VERIFY_DISPLAY_MACROS;
    this.qniCliMacros = readQniCliAdditionalMacros(sourcePath);
  },
);

Given("検証ハーネスと値が異なる qni-cli の追加マクロ定義がある", function () {
  const source = fs
    .readFileSync(
      path.join(root, "features/fixtures/qni-cli-quantum-macros.ts"),
      "utf8",
    )
    .replace(
      'bra: ["\\\\left\\\\langle#1\\\\right|", 1]',
      'bra: ["\\\\left\\\\langle#1\\\\right|", 2]',
    );
  setMacroDefinitions(this, source);
});

Then("検証ハーネスの追加マクロは qni-cli と一致する", function () {
  assert.deepEqual(this.verifyDisplayMacros, this.qniCliMacros);
});

Then("検証ハーネスは qni-cli の定義差分を検出する", function () {
  assert.notDeepEqual(this.verifyDisplayMacros, this.qniCliMacros);
});

Given("追加マクロ定義のない qni-cli ソースがある", function () {
  this.qniCliSourcePath = "missing-qni-cli-typesetter.ts";
  this.qniCliSource = "const mathjax = new TeX({ packages: [] });";
});

When("qni-cli の追加マクロ定義を読み取る", function () {
  try {
    extractQniCliAdditionalMacros(this.qniCliSource, this.qniCliSourcePath);
  } catch (error) {
    this.qniCliMacroError = error;
  }
});

Then("読み取り失敗は対象ファイルを示す", function () {
  assert.match(
    this.qniCliMacroError?.message ?? "",
    /macros 定義が見つかりません: missing-qni-cli-typesetter\.ts/u,
  );
});
