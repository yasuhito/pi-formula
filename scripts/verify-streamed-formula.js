#!/usr/bin/env node

const fs = require("node:fs");
const { assistantText } = require("./verify-echo");

function verifyStreamedFormula(session, marker) {
  const formula = fs.readFileSync(marker, "utf8");
  if (!formula) throw new Error("ストリーミング中の表示数式 marker が空です");
  const response = assistantText(fs.readFileSync(session, "utf8"));
  if (!response.includes(formula))
    throw new Error("確定した応答にストリーミング中の表示数式がありません");
}

function main(session, marker) {
  if (!session || !marker)
    throw new Error(
      "Usage: verify-streamed-formula.js <session.jsonl> <formula-marker>",
    );
  verifyStreamedFormula(session, marker);
}

if (require.main === module) {
  try {
    main(process.argv[2], process.argv[3]);
  } catch (error) {
    console.error(`表示数式の切り替え検証失敗: ${error.message}`);
    process.exitCode = 2;
  }
}

module.exports = { verifyStreamedFormula };
