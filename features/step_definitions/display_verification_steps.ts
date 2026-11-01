interface StepWorld {
  corpus: string;
  corpusPath: string;
  directory: string;
  displayFixture: ReturnType<typeof createDisplayVerificationFixture>;
  displayPlan: ReturnType<typeof planDisplay>;
  displayResult: Awaited<
    ReturnType<ReturnType<typeof createDisplayVerificationFixture>["run"]>
  >;
  expandedMacroFormula: string;
  formula: string;
  processAdapter: ReturnType<
    typeof createDisplayVerificationFixture
  >["processAdapter"];
  qniCliMacroError: unknown;
  qniCliMacros: ReturnType<typeof extractQniCliAdditionalMacros>;
  qniCliSource: string;
  qniCliSourcePath: string;
  verifyDisplayMacros: import("../../dist/macros.js").FormulaMacros;
}

const assert: typeof import("node:assert/strict") = require("node:assert/strict");
const fs: typeof import("node:fs") = require("node:fs");
const path: typeof import("node:path") = require("node:path");
const {
  After,
  Given,
  Then,
  When,
}: typeof import("@cucumber/cucumber") = require("@cucumber/cucumber");

const {
  planDisplay,
}: typeof import("../../scripts/plan-display") = require("../../scripts/plan-display");
const {
  expandFormulaMacros,
}: typeof import("../../dist/macros") = require("../../dist/macros");
const {
  extractQniCliAdditionalMacros,
}: typeof import("../../scripts/qni-cli-additional-macros") = require("../../scripts/qni-cli-additional-macros");
const {
  createDisplayVerificationFixture,
}: typeof import("../../test/support/display-verification-fixture.js") = require("../../test/support/display-verification-fixture.js");
const root = path.resolve(__dirname, "../..");

After(function (this: StepWorld) {
  if (this.displayFixture) this.displayFixture.cleanup();
  else if (this.directory)
    fs.rmSync(this.directory, { recursive: true, force: true });
});

Given("実行可能な実表示検証の試験環境がある", function (this: StepWorld) {
  this.displayFixture = createDisplayVerificationFixture();
  this.directory = this.displayFixture.directory;
  this.processAdapter = this.displayFixture.processAdapter;
});

Given("応答がコーパスと異なる", function (this: StepWorld) {
  this.processAdapter.options.response = "$$y$$\n";
});

Given("100 列へ描き直す", function (this: StepWorld) {
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

When("実表示検証の interface を実行する", async function (this: StepWorld) {
  this.displayResult = await this.displayFixture.run();
});

Then("目視確認用のキャプチャを返す", function (this: StepWorld) {
  assert.equal(this.displayResult.kind, "captured");
});

Then("応答確認 stage の失敗を返す", function (this: StepWorld) {
  assert.equal(
    "stage" in this.displayResult ? this.displayResult.stage : undefined,
    "verify-response",
  );
});

Then("変更前後のキャプチャを返す", function (this: StepWorld) {
  assert.equal(
    "captures" in this.displayResult
      ? this.displayResult.captures.length
      : undefined,
    2,
  );
});

Given("Issue 21 の再現コーパスがある", function (this: StepWorld) {
  this.corpusPath = path.join(root, "docs/agents/verify-corpus/issue-21.md");
});

Then(
  "Issue 21 の最後の表示数式がコーパスに含まれる",
  function (this: StepWorld) {
    assert.ok(this.corpus.includes("F_8"));
  },
);

Given("Issue 26 の再現コーパスがある", function (this: StepWorld) {
  this.corpusPath = path.join(root, "docs/agents/verify-corpus/issue-26.md");
});

Then("Issue26のコーパスに表示数式が3件ある", function (this: StepWorld) {
  assert.deepEqual(this.displayPlan.displayFormulas, 3);
});

Then(
  "Issue26の追加マクロを含む表示数式は画像行を作れる",
  function (this: StepWorld) {
    assert.deepEqual(this.displayPlan.imageRows > 0, true);
  },
);

Given("Issue 48 の Grover コーパスがある", function (this: StepWorld) {
  this.corpusPath = path.join(root, "docs/agents/verify-corpus/issue-48.md");
});

Then("bra と braket を含む表示数式を組版できる", function (this: StepWorld) {
  assert.ok(this.displayPlan.imageRows > 0);
});

Given("braket の直後に ket が続く表示数式がある", function (this: StepWorld) {
  this.formula = String.raw`\braket{s|\psi} - \ket{\psi}`;
});

Then("braket と直後の ket は別の項へ展開される", function (this: StepWorld) {
  assert.equal(
    this.expandedMacroFormula,
    String.raw`\left\langle{}s|\psi\right\rangle - \left|\psi\right\rangle`,
  );
});

Given("bra を使う表示数式がある", function (this: StepWorld) {
  this.formula = String.raw`\bra{\psi}`;
});

Then("bra は山括弧と縦線へ展開される", function (this: StepWorld) {
  assert.equal(this.expandedMacroFormula, String.raw`\left\langle\psi\right|`);
});

Given("ket を使う表示数式がある", function (this: StepWorld) {
  this.formula = String.raw`\ket{\psi}`;
});

Then("ket は縦線と山括弧へ展開される", function (this: StepWorld) {
  assert.equal(this.expandedMacroFormula, String.raw`\left|\psi\right\rangle`);
});

Given("Issue 52 の幅掃引コーパスがある", function (this: StepWorld) {
  this.corpusPath = path.join(root, "docs/agents/verify-corpus/issue-52.md");
});

Then("Issue52のコーパスに表示数式が7件ある", function (this: StepWorld) {
  assert.deepEqual(this.displayPlan.displayFormulas, 7);
});

Then("幅掃引コーパスには3項の表示数式が含まれる", function (this: StepWorld) {
  assert.deepEqual(this.corpus.includes("x_1 + x_2 + x_3 = 0"), true);
});

Then("幅掃引コーパスには15項の表示数式が含まれる", function (this: StepWorld) {
  assert.deepEqual(this.corpus.includes("x_{14} + x_{15} = 0"), true);
});

Given(
  "検証ハーネスと書式だけが異なる qni-cli の追加マクロ定義がある",
  function (this: StepWorld) {
    this.qniCliSourcePath =
      process.env.QNI_CLI_MACROS ??
      path.join(root, "features/fixtures/qni-cli-quantum-macros.ts");
    this.verifyDisplayMacros =
      require("../../scripts/verify-display-macros.js").VERIFY_DISPLAY_MACROS;
    this.qniCliSource = fs.readFileSync(this.qniCliSourcePath, "utf8");
  },
);

Given(
  "検証ハーネスと値が異なる qni-cli の追加マクロ定義がある",
  function (this: StepWorld) {
    this.qniCliSourcePath = "qni-cli-quantum-macros.ts";
    this.qniCliSource = fs
      .readFileSync(
        path.join(root, "features/fixtures/qni-cli-quantum-macros.ts"),
        "utf8",
      )
      .replace(
        'bra: ["\\\\left\\\\langle#1\\\\right|", 1]',
        'bra: ["\\\\left\\\\langle#1\\\\right|", 2]',
      );
    this.verifyDisplayMacros =
      require("../../scripts/verify-display-macros.js").VERIFY_DISPLAY_MACROS;
  },
);

Then(
  "検証ハーネスの追加マクロは qni-cli と一致する",
  function (this: StepWorld) {
    assert.deepEqual(this.verifyDisplayMacros, this.qniCliMacros);
  },
);

Then("検証ハーネスは qni-cli の定義差分を検出する", function (this: StepWorld) {
  assert.notDeepEqual(this.verifyDisplayMacros, this.qniCliMacros);
});

Given("追加マクロ定義のない qni-cli ソースがある", function (this: StepWorld) {
  this.qniCliSourcePath = "missing-qni-cli-typesetter.ts";
  this.qniCliSource = "const mathjax = new TeX({ packages: [] });";
});

When("qni-cli の追加マクロ定義を読み取る", function (this: StepWorld) {
  try {
    this.qniCliMacros = extractQniCliAdditionalMacros(
      this.qniCliSource,
      this.qniCliSourcePath,
    );
  } catch (error) {
    this.qniCliMacroError = error;
  }
});

Then("読み取り失敗は対象ファイルを示す", function (this: StepWorld) {
  assert.match(
    this.qniCliMacroError instanceof Error ? this.qniCliMacroError.message : "",
    /macros 定義が見つかりません: missing-qni-cli-typesetter\.ts/u,
  );
});

When("保存済みの再現コーパスを読み取る", function (this: StepWorld) {
  this.corpus = fs.readFileSync(this.corpusPath, "utf8");
});

When("コーパスの表示数式を組版して表示計画を作る", function (this: StepWorld) {
  this.displayPlan = planDisplay(this.corpus, { source: true });
});

When("検証用の追加マクロで表示数式を展開する", function (this: StepWorld) {
  this.expandedMacroFormula = expandFormulaMacros(
    this.formula,
    require("../../scripts/verify-display-macros.js").VERIFY_DISPLAY_MACROS,
  );
});
