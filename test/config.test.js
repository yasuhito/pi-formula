const assert = require("node:assert/strict");
const {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} = require("node:fs");
const { tmpdir } = require("node:os");
const { join } = require("node:path");
const test = require("node:test");

const { loadFormulaConfig, saveDefaultPath } = require("../dist/config.js");

function temporaryConfig(t, value) {
  const xdg = mkdtempSync(join(tmpdir(), "pi-formula-config-"));
  const path = join(xdg, "pi-formula", "config.json");
  t.after(() => rmSync(xdg, { recursive: true, force: true }));
  if (value !== undefined) {
    mkdirSync(join(xdg, "pi-formula"), { recursive: true });
    writeFileSync(path, value);
  }
  return { env: { XDG_CONFIG_HOME: xdg }, path };
}

for (const xdg of ["", "relative", "~/.config"]) {
  test(`${JSON.stringify(xdg)} XDG_CONFIG_HOME falls back to HOME config`, () => {
    const loaded = loadFormulaConfig({
      XDG_CONFIG_HOME: xdg,
      HOME: "/home/formula-user",
    });

    assert.equal(
      loaded.filePath,
      join("/home/formula-user", ".config", "pi-formula", "config.json"),
    );
  });
}

test("one XDG config supplies the default path and user macros", (t) => {
  const config = temporaryConfig(
    t,
    JSON.stringify({ path: "image", macros: { configured: "x" } }),
  );

  assert.deepEqual(loadFormulaConfig(config.env), {
    filePath: config.path,
    defaultPath: "image",
    macros: { configured: "x" },
    errors: [],
  });
});

test("an environment macro overrides the XDG definition", (t) => {
  const config = temporaryConfig(
    t,
    JSON.stringify({ macros: { chosen: "configured" } }),
  );

  assert.deepEqual(
    loadFormulaConfig({
      ...config.env,
      PI_FORMULA_MACROS: JSON.stringify({ chosen: "environment" }),
    }).macros,
    { chosen: "environment" },
  );
});

test("saving a default path preserves macros and unknown settings", (t) => {
  const config = temporaryConfig(
    t,
    JSON.stringify({ macros: { kept: "x" }, future: true }),
  );

  saveDefaultPath(config.path, "text");

  assert.deepEqual(JSON.parse(readFileSync(config.path, "utf8")), {
    macros: { kept: "x" },
    future: true,
    path: "text",
  });
});

test("saving auto removes only the default path", (t) => {
  const config = temporaryConfig(
    t,
    JSON.stringify({ path: "image", macros: { kept: "x" } }),
  );

  saveDefaultPath(config.path, "auto");

  assert.deepEqual(JSON.parse(readFileSync(config.path, "utf8")), {
    macros: { kept: "x" },
  });
});

test("saving auto deletes an otherwise empty config", (t) => {
  const config = temporaryConfig(t, JSON.stringify({ path: "image" }));

  saveDefaultPath(config.path, "auto");

  assert.equal(existsSync(config.path), false);
});

test("saving a default path rejects invalid JSON without replacing it", (t) => {
  const config = temporaryConfig(t, "{ broken JSON");

  assert.throws(() => saveDefaultPath(config.path, "text"));
});
