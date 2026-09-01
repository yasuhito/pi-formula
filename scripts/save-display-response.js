#!/usr/bin/env node

const fs = require("node:fs");
const path = require("node:path");
const { assistantText } = require("./verify-echo");

function saveDisplayResponse(session, destination) {
  const response = assistantText(fs.readFileSync(session, "utf8"));
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.writeFileSync(destination, response);
}

function main() {
  const [session, destination] = process.argv.slice(2);
  if (!session || !destination) {
    console.error(
      "Usage: save-display-response.js <session.jsonl> <corpus.md>",
    );
    process.exitCode = 2;
    return;
  }
  try {
    saveDisplayResponse(session, destination);
  } catch (error) {
    console.error(`応答の保存失敗: ${error.message}`);
    process.exitCode = 2;
  }
}

if (require.main === module) main();
module.exports = { saveDisplayResponse };
