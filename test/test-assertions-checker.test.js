const assert = require("node:assert/strict");
const test = require("node:test");
const {
  inspectFeatureSource,
  inspectJavaScriptSource,
} = require("../scripts/check-test-assertions");

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
