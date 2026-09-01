const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const { spawnSync } = require("node:child_process");

const saver = path.resolve(__dirname, "../scripts/save-display-response.js");

function saveResponse(message) {
  const directory = fs.mkdtempSync(
    path.join(os.tmpdir(), "pi-formula-save-response-"),
  );
  const session = path.join(directory, "session.jsonl");
  const corpus = path.join(directory, "corpus.md");
  fs.writeFileSync(
    session,
    `${JSON.stringify({ type: "message", message })}\n`,
  );
  const result = spawnSync(process.execPath, [saver, session, corpus], {
    encoding: "utf8",
  });
  const saved = fs.existsSync(corpus) ? fs.readFileSync(corpus, "utf8") : null;
  fs.rmSync(directory, { recursive: true, force: true });
  return { result, saved };
}

test("探索で得た完了済み応答を一字一句そのまま保存する", () => {
  const response = "本文です。\n\n$$\\frac{1}{2}$$\n";
  const { result, saved } = saveResponse({
    role: "assistant",
    stopReason: "stop",
    content: [{ type: "text", text: response }],
  });
  assert.deepEqual(
    { status: result.status, saved },
    { status: 0, saved: response },
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
