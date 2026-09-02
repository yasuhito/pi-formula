#!/usr/bin/env node

const fs = require("node:fs");

function assistantText(session) {
  const records = session.trim().split("\n").filter(Boolean).map(JSON.parse);
  const assistant = records
    .filter(
      (record) =>
        record.type === "message" && record.message?.role === "assistant",
    )
    .at(-1);
  if (assistant?.message.stopReason !== "stop") {
    throw new Error("最後の assistant message が完了していません");
  }
  if (!Array.isArray(assistant.message.content))
    throw new Error("assistant content が配列ではありません");
  return assistant.message.content
    .filter((part) => part?.type === "text" && typeof part.text === "string")
    .map((part) => part.text)
    .join("");
}

function withoutTrailingNewlines(text) {
  let end = text.length;
  while (end > 0) {
    const code = text.charCodeAt(end - 1);
    if (code !== 10 && code !== 13) break;
    end -= 1;
  }
  return text.slice(0, end);
}

function verifyEcho(corpus, session) {
  const expected = withoutTrailingNewlines(fs.readFileSync(corpus, "utf8"));
  const actual = withoutTrailingNewlines(
    assistantText(fs.readFileSync(session, "utf8")),
  );
  if (actual !== expected) {
    let mismatch = 0;
    while (
      mismatch < actual.length &&
      mismatch < expected.length &&
      actual[mismatch] === expected[mismatch]
    )
      mismatch += 1;
    throw new Error(
      `assistant の応答がコーパスと一字一句一致しません (末尾改行を除く; 位置 ${mismatch}, expected ${expected.length} 文字, actual ${actual.length} 文字)`,
    );
  }
}

function main() {
  const [corpus, session] = process.argv.slice(2);
  if (!corpus || !session) {
    console.error("Usage: verify-echo.js <corpus.md> <session.jsonl>");
    process.exitCode = 2;
    return;
  }
  try {
    verifyEcho(corpus, session);
  } catch (error) {
    console.error(`echo 検証失敗: ${error.message}`);
    process.exitCode = 2;
  }
}

if (require.main === module) main();
module.exports = { assistantText, verifyEcho, withoutTrailingNewlines };
