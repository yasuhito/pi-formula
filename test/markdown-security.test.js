const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const markdownSource = fs.readFileSync(
  path.resolve(__dirname, "../src/markdown.ts"),
  "utf8",
);

test("コードフェンスの入力を正規表現パターンへ埋め込まない", () => {
  assert.doesNotMatch(markdownSource, /new RegExp/u);
});
