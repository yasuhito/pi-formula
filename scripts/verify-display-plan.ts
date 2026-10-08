#!/usr/bin/env node

import { type DisplayPlanOptions, planDisplay } from "./plan-display.js";

function validatePlan(plan: ReturnType<typeof planDisplay>) {
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
  if (!Number.isSafeInteger(plan.initialWidth) || plan.initialWidth < 1) {
    throw new Error("表示計画の初期幅が不正です");
  }
  if (
    plan.reflowWidth !== null &&
    (!Number.isSafeInteger(plan.reflowWidth) || plan.reflowWidth < 1)
  ) {
    throw new Error("表示計画のリフロー幅が不正です");
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

function verifyDisplayPlan(corpus: string, options: DisplayPlanOptions = {}) {
  return validatePlan(planDisplay(corpus, options));
}

function main() {
  const args = process.argv.slice(2);
  let displayPath: string | undefined = "image";
  let reflow: number | null = null;
  while (args[0]?.startsWith("--")) {
    const option = args.shift();
    const value = args.shift();
    if (option === "--path") displayPath = value;
    else if (option === "--reflow") reflow = Number(value);
    else {
      args.unshift(
        ...[value, option].filter((item): item is string => item !== undefined),
      );
      break;
    }
  }
  const corpus = args[0];
  if (
    !corpus ||
    args.length !== 1 ||
    (displayPath !== "image" && displayPath !== "text") ||
    (reflow !== null && (!Number.isSafeInteger(reflow) || reflow < 1))
  ) {
    console.error(
      "Usage: verify-display-plan.js [--path <image|text>] [--reflow <cols>] <corpus.md>",
    );
    process.exitCode = 2;
    return;
  }
  try {
    const plan = verifyDisplayPlan(corpus, { path: displayPath, reflow });
    console.error(
      `verify-display: 組版に失敗した表示数式: ${plan.failedFormulas}`,
    );
    process.stdout.write(`${JSON.stringify(plan)}\n`);
  } catch (error) {
    console.error(
      `表示計画失敗: ${error instanceof Error ? error.message : String(error)}`,
    );
    process.exitCode = 2;
  }
}

if (require.main === module) main();
