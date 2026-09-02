const assert = require("node:assert/strict");
const { readdirSync, readFileSync, statSync } = require("node:fs");
const { join, resolve } = require("node:path");
const test = require("node:test");

const root = resolve(__dirname, "..");

function packedPackage(packOutput) {
  return Array.isArray(packOutput)
    ? packOutput[0]
    : typeof packOutput?.filename === "string"
      ? packOutput
      : packOutput?.["pi-formula"];
}

test("package exposes the compatible Formula API and existing-PNG API", () => {
  const manifest = require(join(root, "package.json"));
  const exported = require(root);

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

test("source contains no qni-specific execution modules", () => {
  const sourceDir = join(root, "src");
  const pending = [sourceDir];
  const files = [];
  while (pending.length > 0) {
    const directory = pending.pop();
    for (const name of readdirSync(directory)) {
      const path = join(directory, name);
      if (statSync(path).isDirectory()) pending.push(path);
      else files.push(path);
    }
  }
  const source = files.map((file) => readFileSync(file, "utf8")).join("\n");

  assert.deepEqual(
    {
      hasSource: files.length > 0,
      hasQniSpecificCode: /qni|workdir|registerTool/iu.test(source),
    },
    {
      hasSource: true,
      hasQniSpecificCode: false,
    },
  );
});
