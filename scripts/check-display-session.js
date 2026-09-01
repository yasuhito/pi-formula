#!/usr/bin/env node

const fs = require("node:fs");

function sessionState(filename) {
  if (!fs.existsSync(filename)) return "pending";
  const source = fs.readFileSync(filename, "utf8").trim();
  if (!source) return "pending";
  const records = source.split("\n").map(JSON.parse);
  return records.some(
    (record) =>
      record.type === "message" &&
      record.message?.role === "assistant" &&
      record.message?.stopReason === "stop",
  )
    ? "complete"
    : "pending";
}

function main(filename) {
  if (!filename)
    throw new Error("Usage: check-display-session.js <session.jsonl>");
  process.exitCode = sessionState(filename) === "complete" ? 0 : 1;
}

if (require.main === module) {
  try {
    main(process.argv[2]);
  } catch (error) {
    console.error(`セッション検査失敗: ${error.message}`);
    process.exitCode = 2;
  }
}

module.exports = { sessionState };
