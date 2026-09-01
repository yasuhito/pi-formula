const assert = require("node:assert/strict");
const { readdirSync, readFileSync, statSync } = require("node:fs");
const { join, resolve } = require("node:path");
const test = require("node:test");

const root = resolve(__dirname, "..");

function packedPackage(packOutput) {
  const candidate = Array.isArray(packOutput)
    ? packOutput[0]
    : typeof packOutput?.filename === "string"
      ? packOutput
      : packOutput?.["pi-formula"];
  assert.equal(typeof candidate?.filename, "string");
  assert.notEqual(candidate.filename.trim(), "");
  return candidate;
}

test("package exposes the CommonJS registration and PNG creation API", () => {
  const manifest = require(join(root, "package.json"));
  const exported = require(root);

  assert.deepEqual(
    {
      moduleType: manifest.type,
      registerFormula: typeof exported.registerFormula,
      createFormulaPng: typeof exported.createFormulaPng,
    },
    {
      moduleType: "commonjs",
      registerFormula: "function",
      createFormulaPng: "function",
    },
  );
});

test("npm pack result accepts every supported JSON shape", () => {
  const expected = { filename: "pi-formula-0.1.0.tgz" };

  assert.deepEqual(
    [
      packedPackage([expected]),
      packedPackage(expected),
      packedPackage({ "pi-formula": expected }),
    ],
    [expected, expected, expected],
  );
});

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
