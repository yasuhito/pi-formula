#!/usr/bin/env node

const fs = require("node:fs");
const path = require("node:path");
const { hasCompleteDisplayFormula } = require("./display-stream-formula");
const { assistantText, withoutTrailingNewlines } = require("./verify-echo");

function targetAssistantText(session, formula) {
  const records = session.trim().split("\n").filter(Boolean).map(JSON.parse);
  const target = records.find((record) => {
    if (
      record.type !== "message" ||
      record.message?.role !== "assistant" ||
      typeof record.message.stopReason !== "string" ||
      !Array.isArray(record.message.content)
    )
      return false;
    const text = record.message.content
      .filter((part) => part?.type === "text" && typeof part.text === "string")
      .map((part) => part.text)
      .join("");
    return hasCompleteDisplayFormula(text, formula);
  });
  if (!target)
    throw new Error("実表示検査の対象式を含む assistant message がありません");
  return target.message.content
    .filter((part) => part?.type === "text" && typeof part.text === "string")
    .map((part) => part.text)
    .join("");
}

function saveDisplayResponse(session, destination, formulaMarker) {
  const serialized = fs.readFileSync(session, "utf8");
  const response = formulaMarker
    ? targetAssistantText(serialized, fs.readFileSync(formulaMarker, "utf8"))
    : assistantText(serialized);
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.writeFileSync(destination, withoutTrailingNewlines(response));
}

function main() {
  const [session, destination, formulaMarker] = process.argv.slice(2);
  if (!session || !destination) {
    console.error(
      "Usage: save-display-response.js <session.jsonl> <corpus.md> [formula-marker]",
    );
    process.exitCode = 2;
    return;
  }
  try {
    saveDisplayResponse(session, destination, formulaMarker);
  } catch (error) {
    console.error(`応答の保存失敗: ${error.message}`);
    process.exitCode = 2;
  }
}

if (require.main === module) main();
module.exports = { saveDisplayResponse };
