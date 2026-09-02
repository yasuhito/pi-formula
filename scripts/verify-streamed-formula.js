#!/usr/bin/env node

const fs = require("node:fs");
const { hasCompleteDisplayFormula } = require("./display-stream-formula");

function assistantTexts(session) {
  return session
    .trim()
    .split("\n")
    .filter(Boolean)
    .map(JSON.parse)
    .filter(
      (record) =>
        record.type === "message" && record.message?.role === "assistant",
    )
    .map((record) => {
      if (!Array.isArray(record.message.content))
        throw new Error("assistant content が配列ではありません");
      return record.message.content
        .filter(
          (part) => part?.type === "text" && typeof part.text === "string",
        )
        .map((part) => part.text)
        .join("");
    });
}

function verifyStreamedFormula(session, marker, finalMarker) {
  const formula = fs.readFileSync(marker, "utf8");
  if (!formula) throw new Error("ストリーミング中の表示数式 marker が空です");
  const responses = assistantTexts(fs.readFileSync(session, "utf8"));
  if (
    !responses.some((response) => hasCompleteDisplayFormula(response, formula))
  )
    throw new Error(
      "確定した assistant message でストリーミング中の式が表示数式として認識されません",
    );
  const finalPath = fs.readFileSync(finalMarker, "utf8").trim();
  if (finalPath !== "image")
    throw new Error(
      "対象の assistant message で表示数式が画像経路を通りません",
    );
}

function main(session, marker, finalMarker) {
  if (!session || !marker || !finalMarker)
    throw new Error(
      "Usage: verify-streamed-formula.js <session.jsonl> <formula-marker> <final-path-marker>",
    );
  verifyStreamedFormula(session, marker, finalMarker);
}

if (require.main === module) {
  try {
    main(process.argv[2], process.argv[3], process.argv[4]);
  } catch (error) {
    console.error(`表示数式の切り替え検証失敗: ${error.message}`);
    process.exitCode = 2;
  }
}

module.exports = { verifyStreamedFormula };
