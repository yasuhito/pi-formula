const assert = require("node:assert/strict");
const test = require("node:test");

const { verifyStreamedFormula } = require("../scripts/verify-streamed-formula");

const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

function fixture(response, formula, finalPath = "image") {
  const directory = fs.mkdtempSync(
    path.join(os.tmpdir(), "pi-formula-streamed-formula-"),
  );
  const session = path.join(directory, "session.jsonl");
  const marker = path.join(directory, "formula.md");
  const finalMarker = path.join(directory, "final-path.txt");
  const responses = Array.isArray(response) ? response : [response];
  fs.writeFileSync(
    session,
    `${responses
      .map((text, index) =>
        JSON.stringify({
          type: "message",
          message: {
            role: "assistant",
            stopReason: index === responses.length - 1 ? "stop" : "toolUse",
            content: [{ type: "text", text }],
          },
        }),
      )
      .join("\n")}\n`,
  );
  fs.writeFileSync(marker, formula);
  fs.writeFileSync(finalMarker, `${finalPath}\n`);
  return { directory, finalMarker, marker, session };
}

test("確定本文にストリーミング中と同じ表示数式があれば受理する", () => {
  const files = fixture("説明です。\n\n$$x^2$$", "$$x^2$$");
  assert.doesNotThrow(() =>
    verifyStreamedFormula(files.session, files.marker, files.finalMarker),
  );
  fs.rmSync(files.directory, { recursive: true, force: true });
});

test("tool利用後の最終messageに式がなくても対象messageの画像経路を受理する", () => {
  const files = fixture(
    ["説明です。\n\n$$x^2$$", "tool の結果を確認しました。"],
    "$$x^2$$",
  );
  assert.doesNotThrow(() =>
    verifyStreamedFormula(files.session, files.marker, files.finalMarker),
  );
  fs.rmSync(files.directory, { recursive: true, force: true });
});

test("確定本文で対象式が通常のコードになった場合は拒否する", () => {
  const files = fixture("説明です。\n\n`$$x^2$$`", "$$x^2$$");
  assert.throws(
    () => verifyStreamedFormula(files.session, files.marker, files.finalMarker),
    /表示数式として認識されません/u,
  );
  fs.rmSync(files.directory, { recursive: true, force: true });
});

test("対象式が原文へ戻り後続の別の式だけ画像になった場合は拒否する", () => {
  const files = fixture("$$\\bad$$\n\n$$x^2$$", "$$\\bad$$", "text");
  assert.throws(
    () => verifyStreamedFormula(files.session, files.marker, files.finalMarker),
    /画像経路を通りません/u,
  );
  fs.rmSync(files.directory, { recursive: true, force: true });
});
