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

Given(
  "an executable real display verification test environment exists",
  function (this: StepWorld) {
    this.displayFixture = createDisplayVerificationFixture();
    this.directory = this.displayFixture.directory;
    this.processAdapter = this.displayFixture.processAdapter;
  },
);

Given("the response differs from the corpus", function (this: StepWorld) {
  this.processAdapter.options.response = "$$y$$\n";
});

Given("redraw at 100 columns", function (this: StepWorld) {
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

When(
  "run the real display verification interface",
  async function (this: StepWorld) {
    this.displayResult = await this.displayFixture.run();
  },
);

Then("Captures for visual inspection are returned", function (this: StepWorld) {
  assert.equal(this.displayResult.kind, "captured");
});

Then(
  "A response verification stage failure is returned",
  function (this: StepWorld) {
    assert.equal(
      "stage" in this.displayResult ? this.displayResult.stage : undefined,
      "verify-response",
    );
  },
);

Then(
  "Captures before and after the change are returned",
  function (this: StepWorld) {
    assert.equal(
      "captures" in this.displayResult
        ? this.displayResult.captures.length
        : undefined,
      2,
    );
  },
);

Given("an Issue 21 reproduction corpus exists", function (this: StepWorld) {
  this.corpusPath = path.join(root, "docs/agents/verify-corpus/issue-21.md");
});

Then(
  "The corpus contains the final display formula from Issue 21",
  function (this: StepWorld) {
    assert.ok(this.corpus.includes("F_8"));
  },
);

Given("an Issue 26 reproduction corpus exists", function (this: StepWorld) {
  this.corpusPath = path.join(root, "docs/agents/verify-corpus/issue-26.md");
});

Then(
  "The Issue 26 corpus contains 3 display formulas",
  function (this: StepWorld) {
    assert.deepEqual(this.displayPlan.displayFormulas, 3);
  },
);

Then(
  "Display math containing Issue 26 extra macros can produce image rows",
  function (this: StepWorld) {
    assert.deepEqual(this.displayPlan.imageRows > 0, true);
  },
);

Given("an Issue 48 Grover corpus exists", function (this: StepWorld) {
  this.corpusPath = path.join(root, "docs/agents/verify-corpus/issue-48.md");
});

Then(
  "Display math containing bra and braket can be typeset",
  function (this: StepWorld) {
    assert.ok(this.displayPlan.imageRows > 0);
  },
);

Given(
  "display math contains braket immediately followed by ket",
  function (this: StepWorld) {
    this.formula = String.raw`\braket{s|\psi} - \ket{\psi}`;
  },
);

Then(
  "braket and the immediately following ket expand into separate terms",
  function (this: StepWorld) {
    assert.equal(
      this.expandedMacroFormula,
      String.raw`\left\langle{}s|\psi\right\rangle - \left|\psi\right\rangle`,
    );
  },
);

Given("display math uses bra", function (this: StepWorld) {
  this.formula = String.raw`\bra{\psi}`;
});

Then(
  "bra expands to an angle bracket and a vertical bar",
  function (this: StepWorld) {
    assert.equal(
      this.expandedMacroFormula,
      String.raw`\left\langle\psi\right|`,
    );
  },
);

Given("display math uses ket", function (this: StepWorld) {
  this.formula = String.raw`\ket{\psi}`;
});

Then(
  "ket expands to a vertical bar and an angle bracket",
  function (this: StepWorld) {
    assert.equal(
      this.expandedMacroFormula,
      String.raw`\left|\psi\right\rangle`,
    );
  },
);

Given("an Issue 52 width-sweep corpus exists", function (this: StepWorld) {
  this.corpusPath = path.join(root, "docs/agents/verify-corpus/issue-52.md");
});

Then(
  "The Issue 52 corpus contains 7 display formulas",
  function (this: StepWorld) {
    assert.deepEqual(this.displayPlan.displayFormulas, 7);
  },
);

Then(
  "The width-sweep corpus contains display math with 3 terms",
  function (this: StepWorld) {
    assert.deepEqual(this.corpus.includes("x_1 + x_2 + x_3 = 0"), true);
  },
);

Then(
  "The width-sweep corpus contains display math with 15 terms",
  function (this: StepWorld) {
    assert.deepEqual(this.corpus.includes("x_{14} + x_{15} = 0"), true);
  },
);

Given(
  "qni-cli extra macro definitions differ only in formatting from the verification harness",
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
  "qni-cli extra macro definitions differ in value from the verification harness",
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
  "The verification harness extra macros match qni-cli",
  function (this: StepWorld) {
    assert.deepEqual(this.verifyDisplayMacros, this.qniCliMacros);
  },
);

Then(
  "The verification harness detects qni-cli definition differences",
  function (this: StepWorld) {
    assert.notDeepEqual(this.verifyDisplayMacros, this.qniCliMacros);
  },
);

Given(
  "qni-cli source has no extra macro definitions",
  function (this: StepWorld) {
    this.qniCliSourcePath = "missing-qni-cli-typesetter.ts";
    this.qniCliSource = "const mathjax = new TeX({ packages: [] });";
  },
);

When("read the qni-cli extra macro definitions", function (this: StepWorld) {
  try {
    this.qniCliMacros = extractQniCliAdditionalMacros(
      this.qniCliSource,
      this.qniCliSourcePath,
    );
  } catch (error) {
    this.qniCliMacroError = error;
  }
});

Then("Read failures identify the affected file", function (this: StepWorld) {
  assert.match(
    this.qniCliMacroError instanceof Error ? this.qniCliMacroError.message : "",
    /macros definition not found: missing-qni-cli-typesetter\.ts/u,
  );
});

When("Read saved reproduction corpora", function (this: StepWorld) {
  this.corpus = fs.readFileSync(this.corpusPath, "utf8");
});

When(
  "typeset corpus display math to create a display plan",
  function (this: StepWorld) {
    this.displayPlan = planDisplay(this.corpus, { source: true });
  },
);

When(
  "expand display math using verification extra macros",
  function (this: StepWorld) {
    this.expandedMacroFormula = expandFormulaMacros(
      this.formula,
      require("../../scripts/verify-display-macros.js").VERIFY_DISPLAY_MACROS,
    );
  },
);
