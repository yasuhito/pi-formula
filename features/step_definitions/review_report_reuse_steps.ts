interface StepWorld {
  reviewDirectory: string;
  reviewReportPath: string;
  reviewResolution: {
    reportValid: boolean;
    createReviewTerminal: boolean;
    nextStep: string;
    passGate: string | null;
  };
  reviewResolutionProcess: import("node:child_process").SpawnSyncReturns<string>;
}

const assert: typeof import("node:assert/strict") = require("node:assert/strict");
const {
  existsSync,
  mkdtempSync,
  rmSync,
  writeFileSync,
}: typeof import("node:fs") = require("node:fs");
const { tmpdir }: typeof import("node:os") = require("node:os");
const { join, resolve }: typeof import("node:path") = require("node:path");
const {
  spawnSync,
}: typeof import("node:child_process") = require("node:child_process");
const {
  After,
  Given,
  Then,
  When,
}: typeof import("@cucumber/cucumber") = require("@cucumber/cucumber");

const root = resolve(__dirname, "../..");
const head = "0123456789abcdef";
const validReport = [
  `HEAD: ${head}`,
  "VERDICT: PASS",
  "",
  "<review>PASS</review>",
  "<promise>COMPLETE</promise>",
  "",
].join("\n");

function prepareReport(world: StepWorld, report: string | undefined) {
  world.reviewDirectory = mkdtempSync(join(tmpdir(), "pi-formula-review-"));
  world.reviewReportPath = join(world.reviewDirectory, "report.md");
  if (report !== undefined) writeFileSync(world.reviewReportPath, report);
}

After(function (this: StepWorld) {
  if (this.reviewDirectory) {
    rmSync(this.reviewDirectory, { recursive: true, force: true });
  }
});

Given("現 HEAD の有効な PASS レポートが残っている", function (this: StepWorld) {
  prepareReport(this, validReport);
});

Given(
  /^現 HEAD のレポートが「(.+)」である$/,
  function (this: StepWorld, defect: string) {
    const reports: Record<string, string | undefined> = {
      ファイルなし: undefined,
      "HEAD 不一致": validReport.replace(head, "different-head"),
      "VERDICT なし": validReport.replace("VERDICT: PASS\n", ""),
      "COMPLETE なし": validReport.replace("<promise>COMPLETE</promise>\n", ""),
    };
    prepareReport(this, reports[defect]);
  },
);

When("レビュー判定フローを解決する", function (this: StepWorld) {
  this.reviewResolutionProcess = spawnSync(
    "npm",
    [
      "run",
      "--silent",
      "automation:resolve-review-report",
      "--",
      "resolve",
      this.reviewReportPath,
      head,
    ],
    { cwd: root, encoding: "utf8" },
  );
  this.reviewResolution = JSON.parse(this.reviewResolutionProcess.stdout);
});

Then("有効な独立レビューの解決は正常終了する", function (this: StepWorld) {
  assert.deepEqual(this.reviewResolutionProcess.status, 0);
});

Then("有効な独立レビューのレポートは保持される", function (this: StepWorld) {
  assert.deepEqual(existsSync(this.reviewReportPath), true);
});

Then("現HEADの有効なレポートは有効と判定される", function (this: StepWorld) {
  assert.deepEqual(this.reviewResolution.reportValid, true);
});

Then(
  "有効な独立レビューではterminal作成を要求しない",
  function (this: StepWorld) {
    assert.deepEqual(this.reviewResolution.createReviewTerminal, false);
  },
);

Then("有効な独立レビューの次の段階は6.2である", function (this: StepWorld) {
  assert.deepEqual(this.reviewResolution.nextStep, "6.2");
});

Then("無効な独立レビューの解決は正常終了する", function (this: StepWorld) {
  assert.deepEqual(this.reviewResolutionProcess.status, 0);
});

Then("無効な独立レビューのレポートは削除される", function (this: StepWorld) {
  assert.deepEqual(existsSync(this.reviewReportPath), false);
});

Then("欠陥のあるレポートは無効と判定される", function (this: StepWorld) {
  assert.deepEqual(this.reviewResolution.reportValid, false);
});

Then(
  "無効な独立レビューではterminal作成を要求する",
  function (this: StepWorld) {
    assert.deepEqual(this.reviewResolution.createReviewTerminal, true);
  },
);

Then("再利用した PASS 判定の行き先は 7.5 である", function (this: StepWorld) {
  assert.equal(this.reviewResolution.passGate, "7.5");
});
