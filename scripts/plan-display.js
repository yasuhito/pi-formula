#!/usr/bin/env node

const fs = require("node:fs");
const { transformDisplayMath } = require("../dist/markdown.js");
const { typesetMath } = require("../dist/typesetter.js");
const { VERIFY_DISPLAY_MACROS } = require("./verify-display-macros.js");

const MIN_HEIGHT = 8000;
const MAX_HEIGHT = 16000;
const FIXED_UI_HEIGHT = 3000;
const TEXT_LINE_HEIGHT = 24;
const IMAGE_ROW_HEIGHT = 20;
const HISTORY_COPIES = 2;
const AVAILABLE_COLUMNS = 220;
const CELL = Object.freeze({ widthPx: 8, heightPx: 16 });

function sourceRows(markdown) {
  return markdown
    .split("\n")
    .reduce(
      (sum, line) =>
        sum + Math.max(1, Math.ceil(Array.from(line).length / 120)),
      0,
    );
}

function planDisplay(input, options = {}) {
  const markdown = options.source ? input : fs.readFileSync(input, "utf8");
  let displayFormulas = 0;
  let failedFormulas = 0;
  let imageRows = 0;
  transformDisplayMath(markdown, (latex, original) => {
    displayFormulas += 1;
    try {
      const image = typesetMath(
        latex,
        "#282823",
        AVAILABLE_COLUMNS,
        CELL,
        VERIFY_DISPLAY_MACROS,
      );
      imageRows += image.rows;
    } catch {
      failedFormulas += 1;
    }
    return original;
  });
  const textRows = sourceRows(markdown);
  const required =
    FIXED_UI_HEIGHT +
    HISTORY_COPIES *
      (textRows * TEXT_LINE_HEIGHT + imageRows * IMAGE_ROW_HEIGHT);
  if (required > MAX_HEIGHT) {
    throw new Error(
      `コーパス全体の表示には ${required}px 必要なため ${MAX_HEIGHT}px に収まりません`,
    );
  }
  return {
    height: Math.max(MIN_HEIGHT, Math.ceil(required)),
    imageRows,
    displayFormulas,
    failedFormulas,
  };
}

function main() {
  const corpus = process.argv[2];
  if (!corpus) {
    console.error("Usage: plan-display.js <corpus.md>");
    process.exitCode = 2;
    return;
  }
  try {
    process.stdout.write(`${JSON.stringify(planDisplay(corpus))}\n`);
  } catch (error) {
    console.error(`表示計画失敗: ${error.message}`);
    process.exitCode = 2;
  }
}

if (require.main === module) main();
module.exports = { planDisplay };
