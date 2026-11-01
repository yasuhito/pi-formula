import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import test from "node:test";
import { isRecord, parseJson } from "./support/json-value.js";

const root = resolve(__dirname, "..");

import { fakePi, resetFormulaState } from "./support/fake-pi.js";
import { packedPackage } from "./support/npm-pack.js";

test("package exposes the compatible Formula API and existing-PNG API", () => {
  const manifest = parseJson(readFileSync(join(root, "package.json"), "utf8"));
  if (!isRecord(manifest)) throw new TypeError("Invalid manifest");
  const exported: typeof import("../dist/api.js") = require(root);

  assert.deepEqual(
    {
      moduleType: manifest.type,
      registerFormula: typeof exported.registerFormula,
      createFormulaPng: typeof exported.createFormulaPng,
      getFormulaPath: typeof exported.getFormulaPath,
      renderPng: typeof exported.renderPng,
    },
    {
      moduleType: "commonjs",
      registerFormula: "function",
      createFormulaPng: "function",
      getFormulaPath: "function",
      renderPng: "function",
    },
  );
});

for (const [shape, packOutput] of [
  ["array", [{ filename: "pi-formula-0.1.0.tgz" }]],
  ["object", { filename: "pi-formula-0.1.0.tgz" }],
  [
    "package-keyed object",
    { "pi-formula": { filename: "pi-formula-0.1.0.tgz" } },
  ],
]) {
  test(`npm pack result accepts the ${shape} JSON shape`, () => {
    assert.deepEqual(packedPackage(packOutput), {
      filename: "pi-formula-0.1.0.tgz",
    });
  });
}

test("the Formula API registers no execution tools", () => {
  resetFormulaState();
  const pi = fakePi();
  const api: typeof import("../dist/api.js") = require(root);
  api.registerFormula(pi.api);
  assert.deepEqual([...pi.tools.keys()], []);
});
