const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const { spawnSync } = require("node:child_process");

const validator = path.resolve(__dirname, "../scripts/verify-echo.js");
const corpus = String.raw`本文 $x$。

$$
\frac{1}{2}
$$`;

function validate(answer) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "pi-formula-echo-"));
  const corpusFile = path.join(directory, "corpus.md");
  const sessionFile = path.join(directory, "session.jsonl");
  fs.writeFileSync(corpusFile, corpus);
  fs.writeFileSync(
    sessionFile,
    `${JSON.stringify({
      type: "message",
      message: {
        role: "assistant",
        stopReason: "stop",
        content: [{ type: "text", text: answer }],
      },
    })}\n`,
  );
  const result = spawnSync(
    process.execPath,
    [validator, corpusFile, sessionFile],
    { encoding: "utf8" },
  );
  fs.rmSync(directory, { recursive: true, force: true });
  return result;
}

test("コーパスと一字一句同じ応答を受理する", () => {
  assert.equal(validate(corpus).status, 0);
});

for (const [name, answer] of [
  ["コードフェンスの追加", `\`\`\`markdown\n${corpus}\n\`\`\``],
  ["Unicode 化", corpus.replace("\\frac{1}{2}", "½")],
  ["前置きの追加", `以下が原文です。\n${corpus}`],
  ["一部の欠落", corpus.replace("本文 $x$。\n\n", "")],
]) {
  test(`${name}を不一致として拒否する`, () => {
    const result = validate(answer);
    assert.equal(result.status, 2);
    assert.match(result.stderr, /一字一句一致しません/u);
  });
}
