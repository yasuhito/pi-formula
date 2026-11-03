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

Given(
  "a valid PASS report for the current HEAD remains",
  function (this: StepWorld) {
    prepareReport(this, validReport);
  },
);

Given(
  /^the current HEAD report has defect "(.+)"$/,
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

When("resolve the review verdict flow", function (this: StepWorld) {
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

Then(
  "Resolving a valid independent review succeeds",
  function (this: StepWorld) {
    assert.deepEqual(this.reviewResolutionProcess.status, 0);
  },
);

Then(
  "The valid independent review report is retained",
  function (this: StepWorld) {
    assert.deepEqual(existsSync(this.reviewReportPath), true);
  },
);

Then(
  "The valid report for the current HEAD is considered valid",
  function (this: StepWorld) {
    assert.deepEqual(this.reviewResolution.reportValid, true);
  },
);

Then(
  "A valid independent review does not require terminal creation",
  function (this: StepWorld) {
    assert.deepEqual(this.reviewResolution.createReviewTerminal, false);
  },
);

Then(
  "The next stage for a valid independent review is 6.2",
  function (this: StepWorld) {
    assert.deepEqual(this.reviewResolution.nextStep, "6.2");
  },
);

Then(
  "Resolving an invalid independent review succeeds",
  function (this: StepWorld) {
    assert.deepEqual(this.reviewResolutionProcess.status, 0);
  },
);

Then(
  "The invalid independent review report is deleted",
  function (this: StepWorld) {
    assert.deepEqual(existsSync(this.reviewReportPath), false);
  },
);

Then("The defective report is considered invalid", function (this: StepWorld) {
  assert.deepEqual(this.reviewResolution.reportValid, false);
});

Then(
  "An invalid independent review requires terminal creation",
  function (this: StepWorld) {
    assert.deepEqual(this.reviewResolution.createReviewTerminal, true);
  },
);

Then("The reused PASS verdict proceeds to 7.5", function (this: StepWorld) {
  assert.equal(this.reviewResolution.passGate, "7.5");
});
