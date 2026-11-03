import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test, { type TestContext } from "node:test";

function check(t: TestContext, source: string) {
  const directory = mkdtempSync(join(tmpdir(), "comments-checker-"));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const file = join(directory, "fixture.ts");
  writeFileSync(file, source);
  return spawnSync(
    process.execPath,
    [resolve(__dirname, "../scripts/check-comments.ts"), file],
    {
      encoding: "utf8",
    },
  );
}

test("explanatory comments fail the CLI", (t) => {
  assert.equal(check(t, "const value = 1;\n// Explain the value\n").status, 1);
});

test("explanatory comment diagnostics identify their line", (t) => {
  assert.match(
    check(t, "const value = 1;\n// Explain the value\n").stderr,
    /fixture\.ts:2 Explanatory comments are not allowed/u,
  );
});

test("comment-like strings and regular expressions are accepted", (t) => {
  assert.equal(
    check(
      t,
      'const text = "// explanation /* text */"; const pattern = /\\/\\/|\\/\\*/;',
    ).status,
    0,
  );
});

test("an exact reference to an existing ADR is accepted", (t) => {
  assert.equal(
    check(t, "// See docs/adr/0003-publish-commonjs-only.md\n").status,
    0,
  );
});
