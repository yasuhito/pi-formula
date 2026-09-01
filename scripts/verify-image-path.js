#!/usr/bin/env node

const fs = require("node:fs");

function verifyImagePath(marker) {
  let selected;
  try {
    selected = fs.readFileSync(marker, "utf8").trim();
  } catch {
    selected = "missing";
  }
  if (selected !== "image") {
    throw new Error(`画像経路を確認できませんでした: ${selected}`);
  }
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
module.exports = { verifyImagePath };
