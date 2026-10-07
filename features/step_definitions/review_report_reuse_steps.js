const assert = require("node:assert/strict");
const { existsSync, mkdtempSync, rmSync, writeFileSync } = require("node:fs");
const { tmpdir } = require("node:os");
const { join, resolve } = require("node:path");
const { spawnSync } = require("node:child_process");
const { After, Given, Then, When } = require("@cucumber/cucumber");

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

function prepareReport(world, report) {
  world.reviewDirectory = mkdtempSync(join(tmpdir(), "pi-formula-review-"));
  world.reviewReportPath = join(world.reviewDirectory, "report.md");
  if (report !== undefined) writeFileSync(world.reviewReportPath, report);
}

After(function () {
  if (this.reviewDirectory) {
    rmSync(this.reviewDirectory, { recursive: true, force: true });
  }
});

Given("現 HEAD の有効な PASS レポートが残っている", function () {
  prepareReport(this, validReport);
});

Given(/^現 HEAD のレポートが「(.+)」である$/, function (defect) {
  const reports = {
    ファイルなし: undefined,
    "HEAD 不一致": validReport.replace(head, "different-head"),
    "VERDICT なし": validReport.replace("VERDICT: PASS\n", ""),
    "COMPLETE なし": validReport.replace("<promise>COMPLETE</promise>\n", ""),
  };
  prepareReport(this, reports[defect]);
});

When("レビュー判定フローを解決する", function () {
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

Then("有効な独立レビューの解決は正常終了する", function () {
  assert.deepEqual(this.reviewResolutionProcess.status, 0);
});

Then("有効な独立レビューのレポートは保持される", function () {
  assert.deepEqual(existsSync(this.reviewReportPath), true);
});

Then("現HEADの有効なレポートは有効と判定される", function () {
  assert.deepEqual(this.reviewResolution.reportValid, true);
});

Then("有効な独立レビューではterminal作成を要求しない", function () {
  assert.deepEqual(this.reviewResolution.createReviewTerminal, false);
});

Then("有効な独立レビューの次の段階は6.2である", function () {
  assert.deepEqual(this.reviewResolution.nextStep, "6.2");
});

Then("無効な独立レビューの解決は正常終了する", function () {
  assert.deepEqual(this.reviewResolutionProcess.status, 0);
});

Then("無効な独立レビューのレポートは削除される", function () {
  assert.deepEqual(existsSync(this.reviewReportPath), false);
});

Then("欠陥のあるレポートは無効と判定される", function () {
  assert.deepEqual(this.reviewResolution.reportValid, false);
});

Then("無効な独立レビューではterminal作成を要求する", function () {
  assert.deepEqual(this.reviewResolution.createReviewTerminal, true);
});

Then("再利用した PASS 判定の行き先は 7.5 である", function () {
  assert.equal(this.reviewResolution.passGate, "7.5");
});
