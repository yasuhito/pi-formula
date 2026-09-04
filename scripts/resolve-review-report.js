const { existsSync, readFileSync, rmSync } = require("node:fs");

function resolveReviewReport(reportPath, expectedHead, removeInvalid = false) {
  const report = existsSync(reportPath) ? readFileSync(reportPath, "utf8") : "";
  const lines = report.split(/\r?\n/u);
  const verdictLine = lines.find((line) =>
    /^VERDICT: (?:PASS|CHANGES_REQUIRED)$/u.test(line),
  );
  const verdict = verdictLine?.slice("VERDICT: ".length);
  const reportValid =
    report.length > 0 &&
    lines.includes(`HEAD: ${expectedHead}`) &&
    verdict !== undefined &&
    lines.includes("<promise>COMPLETE</promise>");

  if (!reportValid && removeInvalid) rmSync(reportPath, { force: true });

  return {
    reportValid,
    createReviewTerminal: !reportValid,
    nextStep: reportValid ? "6.2" : "6",
    passGate: reportValid && verdict === "PASS" ? "7.5" : null,
  };
}

if (require.main === module) {
  const [mode, reportPath, expectedHead] = process.argv.slice(2);
  if (
    !new Set(["inspect", "resolve"]).has(mode) ||
    !reportPath ||
    !expectedHead
  ) {
    console.error(
      "Usage: resolve-review-report <inspect|resolve> <report-path> <expected-head>",
    );
    process.exitCode = 2;
  } else {
    console.log(
      JSON.stringify(
        resolveReviewReport(reportPath, expectedHead, mode === "resolve"),
      ),
    );
  }
}
