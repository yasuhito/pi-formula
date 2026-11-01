import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import {
  copyFileSync,
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test, { type TestContext } from "node:test";
import {
  inspectFeatureSource,
  inspectJavaScriptSource,
} from "../scripts/check-test-assertions";

test("one assertion in a test is accepted", () => {
  const result = inspectJavaScriptSource(`
    test("example", () => {
      assert.equal(actual, expected);
    });
  `);

  assert.deepEqual(result.violations, []);
});

test("assertions hidden in a helper are counted at each call site", () => {
  const result = inspectJavaScriptSource(`
    test("example", () => {
      function expectValue() {
        assert.equal(actual, expected);
      }
      expectValue();
      expectValue();
    });
  `);

  assert.deepEqual(
    result.violations.map(({ line, message }) => ({ line, message })),
    [{ line: 2, message: "test contains 2 assertions" }],
  );
});

test("an assertion repeated by a loop is rejected", () => {
  const result = inspectJavaScriptSource(`
    test("example", () => {
      for (const value of values) {
        assert.ok(value);
      }
    });
  `);

  assert.deepEqual(
    result.violations.map(({ line, message }) => ({ line, message })),
    [{ line: 4, message: "test repeats an assertion" }],
  );
});

test("Cucumber setup steps cannot contain assertions", () => {
  const result = inspectJavaScriptSource(`
    Given("some setup", function () {
      assert.ok(this.ready);
    });
  `);

  assert.deepEqual(
    result.violations.map(({ line, message }) => ({ line, message })),
    [{ line: 2, message: "Given must not contain assertions" }],
  );
});

test("a Cucumber scenario cannot contain multiple outcome steps", () => {
  const result = inspectFeatureSource(`
## Scenario: example

- Given some setup
- When something happens
- Then one outcome holds
- And another outcome holds
  `);

  assert.deepEqual(
    result.violations.map(({ line, message }) => ({ line, message })),
    [{ line: 2, message: "Scenario contains 2 outcome steps" }],
  );
});

test("typed callbacks are inspected as TypeScript source", () => {
  const result = inspectJavaScriptSource(
    `
    test("example", (context: TestContext): void => {
      const actual: number = 1;
      assert.equal(actual, 1);
    });
  `,
    "example.test.ts",
  );
  assert.deepEqual(result, { cases: 1, violations: [] });
});

test("typed helpers retain the assertion count at each call site", () => {
  const result = inspectJavaScriptSource(
    `
    function expectValue(actual: number): void {
      assert.equal(actual, 1);
    }
    test("example", (): void => {
      expectValue(1);
      expectValue(1);
    });
  `,
    "example.test.ts",
  );
  assert.deepEqual(
    result.violations.map(({ message }) => message),
    ["test contains 2 assertions"],
  );
});

test("invalid TypeScript cannot silently pass assertion inspection", () => {
  assert.throws(
    () => inspectJavaScriptSource("const value: = ;", "invalid.ts"),
    /Cannot inspect invalid.ts/u,
  );
});

test("tool cleanup removes outputs whose TypeScript source was deleted", (t) => {
  const root = mkdtempSync(join(tmpdir(), "pi-formula-tools-cleanup-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const scripts = join(root, "scripts");
  mkdirSync(scripts);
  mkdirSync(join(root, "test"));
  copyFileSync(
    resolve(__dirname, "../scripts/clean-tools.ts"),
    join(scripts, "clean-tools.ts"),
  );
  writeFileSync(join(scripts, "removed.js"), "generated");
  writeFileSync(join(scripts, "removed.js.map"), "{}");
  writeFileSync(join(scripts, "handwritten.js"), "original");
  execFileSync(process.execPath, [join(scripts, "clean-tools.ts")]);
  assert.deepEqual(readdirSync(scripts).sort(), [
    "clean-tools.ts",
    "handwritten.js",
  ]);
});

function checkerCli(t: TestContext, source: string) {
  const root = mkdtempSync(join(tmpdir(), "pi-formula-assertion-cli-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  for (const directory of ["scripts", "test", "features/step_definitions"])
    mkdirSync(join(root, directory), { recursive: true });
  symlinkSync(
    resolve(__dirname, "../node_modules"),
    join(root, "node_modules"),
    "dir",
  );
  copyFileSync(
    resolve(__dirname, "../scripts/check-test-assertions.js"),
    join(root, "scripts/check-test-assertions.js"),
  );
  writeFileSync(
    join(root, "test/example.test.ts"),
    `import assert from "node:assert/strict"; import test from "node:test";\n${source}`,
  );
  copyFileSync(
    resolve(__dirname, "../tsconfig.tools.json"),
    join(root, "tsconfig.tools.json"),
  );
  execFileSync(
    join(root, "node_modules/.bin/tsc"),
    ["-p", "tsconfig.tools.json"],
    {
      cwd: root,
      stdio: "inherit",
    },
  );
  const runtime = spawnSync(
    process.execPath,
    ["--test", join(root, "test/example.test.js")],
    { encoding: "utf8" },
  );
  if (runtime.status !== 0)
    throw new Error(
      `Assertion fixture must pass Node runtime: ${runtime.stderr}${runtime.stdout}`,
    );
  return spawnSync(
    process.execPath,
    [join(root, "scripts/check-test-assertions.js")],
    { encoding: "utf8" },
  );
}

const wrappedAssertionCases = [
  [
    "generic helper instantiation",
    'function helper<T>() { assert.ok(true); assert.ok(true); } test("example", () => helper<number>());',
  ],
  [
    "wrapped registration",
    '(test as typeof test)("example", () => { assert.ok(true); assert.ok(true); });',
  ],
  [
    "wrapped assertion call",
    'test("example", () => { (assert.equal as (a: unknown, b: unknown) => void)(1, 1); (assert.equal as (a: unknown, b: unknown) => void)(1, 1); });',
  ],
  [
    "satisfies callback",
    'test("example", (() => { assert.ok(true); assert.ok(true); }) satisfies (() => void));',
  ],
  [
    "as callback",
    'test("example", (() => { assert.ok(true); assert.ok(true); }) as (() => void));',
  ],
  [
    "nested wrappers",
    'test("example", (((() => { assert.ok(true); assert.ok(true); }) as (() => void)) satisfies (() => void))!);',
  ],
  [
    "satisfies helper",
    'const helper = (() => { assert.ok(true); assert.ok(true); }) satisfies (() => void); test("example", () => helper());',
  ],
  [
    "as helper",
    'const helper = (() => { assert.ok(true); assert.ok(true); }) as (() => void); test("example", () => helper());',
  ],
  [
    "wrapped helper call",
    'function helper() { assert.ok(true); assert.ok(true); } test("example", () => (helper as (() => void))());',
  ],
  [
    "wrapped immediate call",
    'test("example", () => ((() => { assert.ok(true); assert.ok(true); }) as (() => void))());',
  ],
  [
    "wrapped loop callback",
    'test("example", () => [1, 2].forEach(((x: number) => assert.ok(x)) satisfies ((x: number) => void)));',
  ],
] as const;
for (const [name, source] of wrappedAssertionCases) {
  test(`assertion CLI rejects ${name}`, (t) => {
    const result = checkerCli(t, source);
    assert.equal(result.status, 1, result.stderr);
  });
}

test("assertion CLI accepts a wrapped single assertion", (t) => {
  const result = checkerCli(
    t,
    'test("example", (() => assert.ok(true)) satisfies (() => void));',
  );
  assert.match(result.stdout, /checked 1 test\/Then callbacks/u);
});

function buildCheckout(t: TestContext) {
  const root = mkdtempSync(join(tmpdir(), "pi-formula-tool-build-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const source = resolve(__dirname, "..");
  for (const directory of [
    "src",
    "scripts",
    "test",
    "features",
    "native",
    ".pi",
  ])
    cpSync(join(source, directory), join(root, directory), { recursive: true });
  for (const file of [
    "package.json",
    "tsconfig.json",
    "tsconfig.tools.json",
    "knip.json",
    ".gitignore",
  ])
    copyFileSync(join(source, file), join(root, file));
  symlinkSync(join(source, "node_modules"), join(root, "node_modules"), "dir");
  return root;
}

test("normal builds remove deleted tests from generated runtime files", (t) => {
  const root = buildCheckout(t);
  const source = join(root, "test/qa-removed.test.ts");
  writeFileSync(
    source,
    'import test from "node:test"; test("QA stale test", () => { throw new Error("QA_STALE_GENERATED_TEST_EXECUTED"); });',
  );
  execFileSync("npm", ["run", "build"], { cwd: root, stdio: "pipe" });
  rmSync(source);
  execFileSync("npm", ["run", "build"], { cwd: root, stdio: "pipe" });
  assert.deepEqual(
    ["qa-removed.test.js", "qa-removed.test.js.map"].filter((file) =>
      existsSync(join(root, "test", file)),
    ),
    [],
  );
});

test("Knip regeneration preserves direct native bootstrap execution", (t) => {
  const root = buildCheckout(t);
  execFileSync("npm", ["run", "build"], { cwd: root, stdio: "pipe" });
  execFileSync("npm", ["run", "knip"], { cwd: root, stdio: "inherit" });
  const result = spawnSync(
    join(root, "scripts/run-vt-pty.js"),
    [
      "--settle-ms",
      "10",
      "--timeout-ms",
      "1000",
      "--",
      "/usr/bin/printf",
      "QA_NATIVE_PROBE",
    ],
    { cwd: root, encoding: "utf8" },
  );
  assert.equal(result.status, 0, result.error?.message ?? result.stderr);
});

const nestedAssertionCases = [
  [
    "doesNotThrow callback",
    'test("example", () => assert.doesNotThrow(() => assert.ok(true)));',
  ],
  [
    "satisfies assertion callback",
    'test("example", () => assert.doesNotThrow((() => assert.ok(true)) satisfies (() => void)));',
  ],
  [
    "as assertion callback",
    'test("example", () => assert.doesNotThrow((() => assert.ok(true)) as (() => void)));',
  ],
  [
    "named assertion callback",
    'function helper() { assert.ok(true); } test("example", () => assert.doesNotThrow(helper));',
  ],
  [
    "wrapped named assertion callback",
    'const helper = (() => assert.ok(true)) satisfies (() => void); test("example", () => assert.doesNotThrow(helper));',
  ],
  [
    "helper called inside assertion callback",
    'function helper() { assert.ok(true); } test("example", () => assert.doesNotThrow(() => helper()));',
  ],
  [
    "nested assertion callbacks",
    'test("example", () => assert.doesNotThrow(() => assert.doesNotThrow(() => assert.ok(true))));',
  ],
  [
    "throws callback",
    'test("example", () => assert.throws(() => { assert.ok(true); throw new Error("expected"); }));',
  ],
  [
    "throws error predicate",
    'test("example", () => assert.throws(() => { throw new Error("expected"); }, () => { assert.ok(true); return true; }));',
  ],
  [
    "rejects async callback",
    'test("example", async () => { await assert.rejects(async () => { assert.ok(true); throw new Error("expected"); }); });',
  ],
  [
    "rejects error predicate",
    'test("example", async () => { await assert.rejects(async () => { throw new Error("expected"); }, () => { assert.ok(true); return true; }); });',
  ],
  [
    "doesNotReject async callback",
    'test("example", async () => { await assert.doesNotReject(async () => { assert.ok(true); }); });',
  ],
  [
    "doesNotReject named callback",
    'async function helper() { assert.ok(true); } test("example", async () => { await assert.doesNotReject(helper); });',
  ],
  [
    "helper receiving a nested callback",
    'function run(callback: () => void) { callback(); } test("example", () => assert.doesNotThrow(() => run(() => assert.ok(true))));',
  ],
] as const;
for (const [name, source] of nestedAssertionCases) {
  test(`assertion CLI rejects ${name}`, (t) => {
    const result = checkerCli(t, source);
    assert.equal(result.status, 1, result.stderr);
  });
}

const assertionFreeCallbacks = [
  ["doesNotThrow", 'test("example", () => assert.doesNotThrow(() => {}));'],
  [
    "throws",
    'test("example", () => assert.throws(() => { throw new Error("expected"); }));',
  ],
  [
    "rejects",
    'test("example", async () => { await assert.rejects(async () => { throw new Error("expected"); }); });',
  ],
  [
    "doesNotReject",
    'test("example", async () => { await assert.doesNotReject(async () => {}); });',
  ],
] as const;
for (const [name, source] of assertionFreeCallbacks) {
  test(`assertion CLI accepts ${name} without nested assertions`, (t) => {
    const result = checkerCli(t, source);
    assert.equal(result.status, 0, result.stderr);
  });
}

const assertionValueCases = [
  [
    "equal function references",
    'function verify(): void { assert.ok(true); throw new Error("FUNCTION_VALUE_INVOKED"); } test("example", () => assert.equal(verify, verify));',
  ],
  [
    "strictEqual wrapped function references",
    'const verify = (() => { assert.ok(true); throw new Error("FUNCTION_VALUE_INVOKED"); }) satisfies (() => void); test("example", () => assert.strictEqual(verify, verify));',
  ],
  [
    "deepEqual function references",
    'function verify(): void { assert.ok(true); throw new Error("FUNCTION_VALUE_INVOKED"); } test("example", () => assert.deepEqual(verify, verify));',
  ],
  [
    "deepStrictEqual function references",
    'function verify(): void { assert.ok(true); throw new Error("FUNCTION_VALUE_INVOKED"); } test("example", () => assert.deepStrictEqual(verify, verify));',
  ],
  [
    "notEqual function references",
    'function verify(): void { assert.ok(true); throw new Error("FUNCTION_VALUE_INVOKED"); } function other(): void { assert.ok(true); throw new Error("FUNCTION_VALUE_INVOKED"); } test("example", () => assert.notEqual(verify, other));',
  ],
  [
    "notStrictEqual function references",
    'function verify(): void { assert.ok(true); throw new Error("FUNCTION_VALUE_INVOKED"); } function other(): void { assert.ok(true); throw new Error("FUNCTION_VALUE_INVOKED"); } test("example", () => assert.notStrictEqual(verify, other));',
  ],
  [
    "notDeepEqual function references",
    'function verify(): void { assert.ok(true); throw new Error("FUNCTION_VALUE_INVOKED"); } function other(): void { assert.ok(true); throw new Error("FUNCTION_VALUE_INVOKED"); } test("example", () => assert.notDeepEqual(verify, other));',
  ],
  [
    "notDeepStrictEqual function references",
    'function verify(): void { assert.ok(true); throw new Error("FUNCTION_VALUE_INVOKED"); } function other(): void { assert.ok(true); throw new Error("FUNCTION_VALUE_INVOKED"); } test("example", () => assert.notDeepStrictEqual(verify, other));',
  ],
  [
    "ok function reference",
    'function verify(): void { assert.ok(true); throw new Error("FUNCTION_VALUE_INVOKED"); } test("example", () => assert.ok(verify));',
  ],
  [
    "callable assert function reference",
    'function verify(): void { assert.ok(true); throw new Error("FUNCTION_VALUE_INVOKED"); } test("example", () => assert(verify));',
  ],
  [
    "inline function value",
    'test("example", () => assert.ok(() => { assert.ok(true); throw new Error("FUNCTION_VALUE_INVOKED"); }));',
  ],
  [
    "computed comparison function references",
    'function verify(): void { assert.ok(true); throw new Error("FUNCTION_VALUE_INVOKED"); } test("example", () => assert["equal"](verify, verify));',
  ],
] as const;
for (const [name, source] of assertionValueCases) {
  test(`assertion CLI accepts ${name}`, (t) => {
    const result = checkerCli(t, source);
    assert.equal(result.status, 0, result.stderr);
  });
}

const executedAssertionValues = [
  [
    "called helper in compared value",
    'function verify(): boolean { assert.ok(true); return true; } test("example", () => assert.equal(verify(), true));',
  ],
  [
    "called inline function in truthiness value",
    'test("example", () => assert.ok((() => { assert.ok(true); return true; })()));',
  ],
  [
    "computed doesNotThrow callback",
    'test("example", () => assert["doesNotThrow"](() => assert.ok(true)));',
  ],
  [
    "wrapped error predicate",
    'test("example", () => assert.throws(() => { throw new Error("expected"); }, (() => { assert.ok(true); return true; }) satisfies ((error: unknown) => boolean)));',
  ],
] as const;
for (const [name, source] of executedAssertionValues) {
  test(`assertion CLI rejects ${name}`, (t) => {
    const result = checkerCli(t, source);
    assert.equal(result.status, 1, result.stderr);
  });
}
