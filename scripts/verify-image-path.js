#!/usr/bin/env node

const fs = require("node:fs");

function verifyDisplayPath(marker, expected = "image") {
  let selected;
  try {
    selected = fs.readFileSync(marker, "utf8").trim();
  } catch {
    selected = "missing";
  }
  if (selected !== expected) {
    const label = expected === "image" ? "画像経路" : "テキスト経路";
    throw new Error(`${label}を確認できませんでした: ${selected}`);
  }
}

function verifyImagePath(marker) {
  verifyDisplayPath(marker, "image");
}

function main() {
  const marker = process.argv[2];
  if (!marker) {
    console.error("Usage: verify-image-path.js <marker>");
    process.exitCode = 2;
    return;
  }
  try {
    verifyImagePath(marker);
  } catch (error) {
    console.error(`画像経路検証失敗: ${error.message}`);
    process.exitCode = 2;
  }
}

if (require.main === module) main();
module.exports = { verifyDisplayPath, verifyImagePath };
