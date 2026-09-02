#!/usr/bin/env node

const { planDisplay } = require("./plan-display.js");

function validatePlan(plan) {
  if (
    !Number.isSafeInteger(plan.height) ||
    plan.height < 1 ||
    plan.height > 16000
  ) {
    throw new Error("表示計画の出力高が不正です");
  }
  if (!Number.isSafeInteger(plan.displayFormulas) || plan.displayFormulas < 1) {
    throw new Error("コーパスに表示数式がありません");
  }
  if (!Number.isSafeInteger(plan.imageRows) || plan.imageRows < 0) {
    throw new Error("表示計画の画像行数が不正です");
  }
  if (
    !Number.isSafeInteger(plan.failedFormulas) ||
    plan.failedFormulas < 0 ||
    plan.failedFormulas > plan.displayFormulas
  ) {
    throw new Error("表示計画の組版失敗数が不正です");
  }
  return plan;
}

function verifyDisplayPlan(corpus) {
  return validatePlan(planDisplay(corpus));
}

function main() {
  const corpus = process.argv[2];
  if (!corpus) {
    console.error("Usage: verify-display-plan.js <corpus.md>");
    process.exitCode = 2;
    return;
  }
  try {
    const plan = verifyDisplayPlan(corpus);
    console.error(
      `verify-display: 組版に失敗した表示数式: ${plan.failedFormulas}`,
    );
    process.stdout.write(`${JSON.stringify(plan)}\n`);
  } catch (error) {
    console.error(`表示計画失敗: ${error.message}`);
    process.exitCode = 2;
  }
}

if (require.main === module) main();
