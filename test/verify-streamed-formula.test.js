const assert = require("node:assert/strict");
const test = require("node:test");

const { verifyStreamedFormula } = require("../scripts/verify-streamed-formula");

const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

function fixture(response, formula) {
  const directory = fs.mkdtempSync(
    path.join(os.tmpdir(), "pi-formula-streamed-formula-"),
  );
  const session = path.join(directory, "session.jsonl");
  const marker = path.join(directory, "formula.md");
  fs.writeFileSync(
    session,
    `${JSON.stringify({
      type: "message",
      message: {
        role: "assistant",
        stopReason: "stop",
        content: [{ type: "text", text: response }],
      },
    })}\n`,
  );
  fs.writeFileSync(marker, formula);
  return { directory, marker, session };
}

test("確定本文にストリーミング中と同じ表示数式があれば受理する", () => {
  const files = fixture("説明です。\n\n$$x^2$$", "$$x^2$$");
  assert.doesNotThrow(() => verifyStreamedFormula(files.session, files.marker));
  fs.rmSync(files.directory, { recursive: true, force: true });
});

test("確定本文からストリーミング中の表示数式が消えた場合は拒否する", () => {
  const files = fixture("説明です。\n\n$$y^2$$", "$$x^2$$");
  assert.throws(
    () => verifyStreamedFormula(files.session, files.marker),
    /確定した応答/u,
  );
  fs.rmSync(files.directory, { recursive: true, force: true });
});
