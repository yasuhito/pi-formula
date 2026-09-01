const { readFile, readdir } = require("node:fs/promises");
const { join, relative } = require("node:path");
const { parseSync } = require("oxc-parser");

const TEST_REGISTRATIONS = new Set(["it", "test"]);
const CUCUMBER_SETUP_REGISTRATIONS = new Set([
  "After",
  "AfterAll",
  "AfterStep",
  "Before",
  "BeforeAll",
  "BeforeStep",
  "Given",
  "When",
]);
const CUCUMBER_REGISTRATIONS = new Set([
  ...CUCUMBER_SETUP_REGISTRATIONS,
  "Then",
]);
const LOOP_TYPES = new Set([
  "DoWhileStatement",
  "ForInStatement",
  "ForOfStatement",
  "ForStatement",
  "WhileStatement",
]);

function walk(node, visitor, parent) {
  if (!node || typeof node.type !== "string") return;
  let skipped = false;
  visitor.enter?.call(
    {
      skip() {
        skipped = true;
      },
    },
    node,
    parent,
  );
  if (!skipped) {
    for (const value of Object.values(node)) {
      if (Array.isArray(value)) {
        for (const child of value) walk(child, visitor, node);
      } else {
        walk(value, visitor, node);
      }
    }
  }
  visitor.leave?.(node, parent);
}

function functionArgument(call) {
  return [...call.arguments]
    .reverse()
    .find(
      (argument) =>
        argument?.type === "ArrowFunctionExpression" ||
        argument?.type === "FunctionExpression",
    );
}

function isAssertion(call) {
  if (call.callee.type === "Identifier") return call.callee.name === "assert";
  return (
    call.callee.type === "MemberExpression" &&
    call.callee.object.type === "Identifier" &&
    call.callee.object.name === "assert"
  );
}

function localFunctions(program) {
  const functions = new Map();
  walk(program, {
    enter(node) {
      if (node.type === "FunctionDeclaration" && node.id) {
        functions.set(node.id.name, node);
      }
      if (
        node.type === "VariableDeclarator" &&
        node.id.type === "Identifier" &&
        (node.init?.type === "ArrowFunctionExpression" ||
          node.init?.type === "FunctionExpression")
      ) {
        functions.set(node.id.name, node.init);
      }
    },
  });
  return functions;
}

function assertionsIn(
  callback,
  functions,
  lineFor,
  repeated = false,
  callStack = [],
) {
  const assertions = [];
  let loopDepth = 0;

  walk(callback.body, {
    enter(node, parent) {
      if (
        node !== callback.body &&
        (node.type === "ArrowFunctionExpression" ||
          node.type === "FunctionExpression" ||
          node.type === "FunctionDeclaration")
      ) {
        const immediatelyCalled =
          parent?.type === "CallExpression" && parent.callee === node;
        const passedToCall =
          parent?.type === "CallExpression" && parent.arguments.includes(node);
        if (immediatelyCalled || passedToCall) {
          assertions.push(
            ...assertionsIn(
              node,
              functions,
              lineFor,
              repeated || passedToCall,
              callStack,
            ),
          );
        }
        this.skip();
        return;
      }

      if (LOOP_TYPES.has(node.type)) loopDepth += 1;
      if (node.type !== "CallExpression") return;

      if (isAssertion(node)) {
        assertions.push({
          line: lineFor(node.start),
          repeated: repeated || loopDepth > 0,
        });
        return;
      }

      if (node.callee.type !== "Identifier") return;
      const helper = functions.get(node.callee.name);
      if (!helper || callStack.includes(node.callee.name)) return;
      assertions.push(
        ...assertionsIn(helper, functions, lineFor, repeated || loopDepth > 0, [
          ...callStack,
          node.callee.name,
        ]),
      );
    },
    leave(node) {
      if (LOOP_TYPES.has(node.type)) loopDepth -= 1;
    },
  });

  return assertions;
}

function inspectJavaScriptSource(source, file = "<source>") {
  const program = parseSync(file, source, {
    sourceType: "unambiguous",
  }).program;
  const functions = localFunctions(program);
  const violations = [];
  let cases = 0;
  const lineStarts = [0];
  for (const match of source.matchAll(/\n/gu)) lineStarts.push(match.index + 1);
  const lineFor = (offset) => {
    let low = 0;
    let high = lineStarts.length;
    while (low + 1 < high) {
      const middle = Math.floor((low + high) / 2);
      if (lineStarts[middle] <= offset) low = middle;
      else high = middle;
    }
    return low + 1;
  };

  walk(program, {
    enter(node) {
      if (node.type !== "CallExpression" || node.callee.type !== "Identifier")
        return;
      const registration = node.callee.name;
      if (
        !TEST_REGISTRATIONS.has(registration) &&
        !CUCUMBER_REGISTRATIONS.has(registration)
      )
        return;

      const callback = functionArgument(node);
      if (!callback) return;
      if (TEST_REGISTRATIONS.has(registration) || registration === "Then") {
        cases += 1;
      }
      const assertions = assertionsIn(callback, functions, lineFor);
      const repeatedAssertion = assertions.find(
        (assertion) => assertion.repeated,
      );
      if (repeatedAssertion) {
        violations.push({
          file,
          line: repeatedAssertion.line,
          message: `${registration} repeats an assertion`,
        });
      }
      if (assertions.length > 1) {
        violations.push({
          file,
          line: lineFor(node.start),
          message: `${registration} contains ${assertions.length} assertions`,
        });
      }
      if (
        CUCUMBER_SETUP_REGISTRATIONS.has(registration) &&
        assertions.length > 0
      ) {
        violations.push({
          file,
          line: lineFor(node.start),
          message: `${registration} must not contain assertions`,
        });
      }
    },
  });

  return { cases, violations };
}

function inspectFeatureSource(source, file = "<feature>") {
  const violations = [];
  const lines = source.split("\n");
  let scenario;
  let scenarios = 0;
  let outcomeSteps = 0;
  let previousKeyword;

  function finishScenario() {
    if (scenario && outcomeSteps > 1) {
      violations.push({
        file,
        line: scenario.line,
        message: `Scenario contains ${outcomeSteps} outcome steps`,
      });
    }
  }

  for (const [index, line] of lines.entries()) {
    const scenarioMatch = line.match(
      /^#{1,6}\s+Scenario(?: Outline)?:\s*(.+?)\s*$/u,
    );
    if (scenarioMatch) {
      finishScenario();
      scenario = { line: index + 1, name: scenarioMatch[1] };
      scenarios += 1;
      outcomeSteps = 0;
      previousKeyword = undefined;
      continue;
    }
    if (!scenario) continue;
    const stepMatch = line.match(/^\s*-\s+(Given|When|Then|And|But)\b/u);
    if (!stepMatch) continue;
    const keyword = stepMatch[1];
    if (keyword === "Then") {
      outcomeSteps += 1;
      previousKeyword = "Then";
    } else if ((keyword === "And" || keyword === "But") && previousKeyword) {
      if (previousKeyword === "Then") outcomeSteps += 1;
    } else {
      previousKeyword = keyword;
    }
  }
  finishScenario();

  return { scenarios, violations };
}

async function javascriptFiles(directory) {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...(await javascriptFiles(path)));
    else if (entry.name.endsWith(".js")) files.push(path);
  }
  return files;
}

async function main() {
  const root = join(__dirname, "..");
  const javascriptPaths = [
    ...(await javascriptFiles(join(root, "test"))),
    ...(await javascriptFiles(join(root, "features", "step_definitions"))),
  ].sort();
  const featurePaths = (await readdir(join(root, "features")))
    .filter((name) => name.endsWith(".feature.md"))
    .map((name) => join(root, "features", name))
    .sort();
  const results = [];

  for (const path of javascriptPaths) {
    results.push(
      inspectJavaScriptSource(
        await readFile(path, "utf8"),
        relative(root, path),
      ),
    );
  }
  for (const path of featurePaths) {
    results.push(
      inspectFeatureSource(await readFile(path, "utf8"), relative(root, path)),
    );
  }

  const violations = results.flatMap((result) => result.violations);
  const cases = results.reduce((sum, result) => sum + (result.cases ?? 0), 0);
  const scenarios = results.reduce(
    (sum, result) => sum + (result.scenarios ?? 0),
    0,
  );
  console.log(
    `Test assertions: checked ${cases} test/Then callbacks and ` +
      `${scenarios} Cucumber scenarios`,
  );
  if (violations.length === 0) return;

  for (const violation of violations) {
    console.error(`${violation.file}:${violation.line} ${violation.message}`);
  }
  process.exitCode = 1;
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}

module.exports = { inspectFeatureSource, inspectJavaScriptSource };
