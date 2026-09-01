const assert = require("node:assert/strict");
const { join } = require("node:path");
const test = require("node:test");

const { formulaConfigPath } = require("../dist/path-settings.js");

for (const xdg of ["", "relative", "~/.config"]) {
  test(`${JSON.stringify(xdg)} XDG_CONFIG_HOME falls back to HOME config`, () => {
    assert.equal(
      formulaConfigPath({ XDG_CONFIG_HOME: xdg, HOME: "/home/formula-user" }),
      join("/home/formula-user", ".config", "pi-formula", "config.json"),
    );
  });
}
