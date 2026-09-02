const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const { spawnSync } = require("node:child_process");

const saver = path.resolve(__dirname, "../scripts/save-display-response.js");

function saveResponse(message, formula) {
  const directory = fs.mkdtempSync(
    path.join(os.tmpdir(), "pi-formula-save-response-"),
  );
  const session = path.join(directory, "session.jsonl");
  const corpus = path.join(directory, "corpus.md");
  const messages = Array.isArray(message) ? message : [message];
  fs.writeFileSync(
    session,
    `${messages
      .map((entry) => JSON.stringify({ type: "message", message: entry }))
      .join("\n")}\n`,
  );
  const args = [saver, session, corpus];
  if (formula) {
    const marker = path.join(directory, "formula.md");
    fs.writeFileSync(marker, formula);
    args.push(marker);
  }
  const result = spawnSync(process.execPath, args, {
    encoding: "utf8",
  });
  const saved = fs.existsSync(corpus) ? fs.readFileSync(corpus, "utf8") : null;
  fs.rmSync(directory, { recursive: true, force: true });
  return { result, saved };
}

test("探索で得た完了済み応答を末尾改行なしで保存する", () => {
  const response = "本文です。\n\n$$\\frac{1}{2}$$\n";
  const { result, saved } = saveResponse({
    role: "assistant",
    stopReason: "stop",
    content: [{ type: "text", text: response }],
  });
  assert.deepEqual(
    { status: result.status, saved },
    { status: 0, saved: response.slice(0, -1) },
  );
});

test("探索で得た応答の末尾空白は保存する", () => {
  const response = "本文です。 \n";
  const { saved } = saveResponse({
    role: "assistant",
    stopReason: "stop",
    content: [{ type: "text", text: response }],
  });
  assert.equal(saved, "本文です。 ");
});

test("tool前に検査した対象式を含むassistant messageを保存する", () => {
  const target = "計算します。\n\n$$x^2$$";
  const { result, saved } = saveResponse(
    [
      {
        role: "assistant",
        stopReason: "toolUse",
        content: [{ type: "text", text: target }],
      },
      {
        role: "assistant",
        stopReason: "stop",
        content: [{ type: "text", text: "計算結果を確認しました。" }],
      },
    ],
    "$$x^2$$",
  );
  assert.deepEqual(
    { status: result.status, saved },
    { status: 0, saved: target },
  );
});

test("未完了の応答をコーパスへ保存しない", () => {
  const { result, saved } = saveResponse({
    role: "assistant",
    stopReason: undefined,
    content: [{ type: "text", text: "生成中" }],
  });
  assert.deepEqual(
    { status: result.status, saved },
    { status: 2, saved: null },
  );
});
