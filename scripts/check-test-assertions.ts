import { readdir, readFile } from "node:fs/promises";
import { join, relative } from "node:path";
import {
  type ArrowFunctionExpression,
  type Function as AstFunction,
  type CallExpression,
  type Node,
  type Program,
  parseSync,
} from "oxc-parser";

type Callback = AstFunction | ArrowFunctionExpression;
interface Violation {
  file: string;
  line: number;
  message: string;
}
interface Inspection {
  cases?: number;
  scenarios?: number;
  violations: Violation[];
}
interface WalkVisitor {
  enter?(this: { skip(): void }, node: Node, parent: Node | undefined): void;
  leave?(node: Node, parent: Node | undefined): void;
}
// Children come only from Oxc's parsed AST, never unvalidated input objects.
function isNode(value: unknown): value is Node {
  return (
    typeof value === "object" &&
    value !== null &&
    "type" in value &&
    typeof value.type === "string" &&
    "start" in value &&
    typeof value.start === "number"
  );
}

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

function walk(node: unknown, visitor: WalkVisitor, parent?: Node): void {
  if (!isNode(node)) return;
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

// These nodes change only types or grouping; their runtime expression is unchanged.
function runtimeExpression(node: Node | undefined): Node | undefined {
  while (node) {
    switch (node.type) {
      case "TSAsExpression":
      case "TSSatisfiesExpression":
      case "TSTypeAssertion":
      case "TSNonNullExpression":
      case "TSInstantiationExpression":
      case "ParenthesizedExpression":
        node = node.expression;
        break;
      default:
        return node;
    }
  }
  return undefined;
}

function isCallback(
  node: Node | undefined,
): node is
  | ArrowFunctionExpression
  | (AstFunction & { type: "FunctionExpression" }) {
  return (
    node?.type === "ArrowFunctionExpression" ||
    node?.type === "FunctionExpression"
  );
}

function functionArgument(
  call: CallExpression,
  functions: Map<string, Callback>,
) {
  for (const argument of [...call.arguments].reverse()) {
    const value = runtimeExpression(argument);
    if (isCallback(value)) return value;
    if (value?.type === "Identifier" && functions.has(value.name))
      return functions.get(value.name);
  }
  return undefined;
}

function isAssertion(call: CallExpression) {
  const callee = runtimeExpression(call.callee);
  if (callee?.type === "Identifier") return callee.name === "assert";
  if (callee?.type !== "MemberExpression") return false;
  const object = runtimeExpression(callee.object);
  return object?.type === "Identifier" && object.name === "assert";
}

const ASSERT_CALLBACK_METHODS = new Set([
  "throws",
  "rejects",
  "doesNotThrow",
  "doesNotReject",
]);

function callbackArguments(call: CallExpression) {
  // Non-assert calls keep the existing conservative callback scan.
  if (!isAssertion(call)) return call.arguments;
  const callee = runtimeExpression(call.callee);
  // assert(value) tests a value; it does not call a function-valued operand.
  if (callee?.type !== "MemberExpression") return [];
  const property = runtimeExpression(callee.property);
  const method =
    !callee.computed && property?.type === "Identifier"
      ? property.name
      : property?.type === "Literal" && typeof property.value === "string"
        ? property.value
        : undefined;
  // A dynamic method cannot be classified statically; keep the prior scan.
  if (method === undefined) return call.arguments;
  // The fixed Node runtimes execute fn/asyncFn at 0 and error predicates at 1.
  // Comparison/truthiness operands and message arguments are values.
  return ASSERT_CALLBACK_METHODS.has(method) ? call.arguments.slice(0, 2) : [];
}

function localFunctions(program: Program) {
  const functions = new Map<string, Callback>();
  walk(program, {
    enter(node) {
      if (node.type === "FunctionDeclaration" && node.id) {
        functions.set(node.id.name, node);
      }
      if (node.type === "VariableDeclarator" && node.id.type === "Identifier") {
        const value = runtimeExpression(node.init ?? undefined);
        if (isCallback(value)) functions.set(node.id.name, value);
      }
    },
  });
  return functions;
}

function assertionsIn(
  callback: Callback,
  functions: Map<string, Callback>,
  lineFor: (offset: number) => number,
  repeated = false,
  callStack: string[] = [],
): Array<{ line: number; repeated: boolean }> {
  const assertions: Array<{ line: number; repeated: boolean }> = [];
  let loopDepth = 0;

  walk(callback.body, {
    enter(node) {
      if (isCallback(node) || node.type === "FunctionDeclaration") {
        // Function bodies are inspected at their call site, after unwrapping types.
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
        // Count the outer call and inspect only the API's callback positions.
        // The walker still visits actual calls inside all value expressions.
      }

      const callee = runtimeExpression(node.callee);
      if (isCallback(callee)) {
        assertions.push(
          ...assertionsIn(
            callee,
            functions,
            lineFor,
            repeated || loopDepth > 0,
            callStack,
          ),
        );
      } else if (callee?.type === "Identifier") {
        const helper = functions.get(callee.name);
        if (helper && !callStack.includes(callee.name))
          assertions.push(
            ...assertionsIn(
              helper,
              functions,
              lineFor,
              repeated || loopDepth > 0,
              [...callStack, callee.name],
            ),
          );
      }
      for (const argument of callbackArguments(node)) {
        const value = runtimeExpression(argument);
        const callback = isCallback(value)
          ? value
          : value?.type === "Identifier"
            ? functions.get(value.name)
            : undefined;
        if (
          callback &&
          !(value?.type === "Identifier" && callStack.includes(value.name))
        )
          assertions.push(
            ...assertionsIn(
              callback,
              functions,
              lineFor,
              true,
              value?.type === "Identifier"
                ? [...callStack, value.name]
                : callStack,
            ),
          );
      }
    },
    leave(node) {
      if (LOOP_TYPES.has(node.type)) loopDepth -= 1;
    },
  });

  return assertions;
}

export function inspectJavaScriptSource(
  source: string,
  file = "<source>",
): Inspection {
  const parsed = parseSync(file, source, {
    sourceType: "unambiguous",
  });
  if (parsed.errors.length > 0) {
    throw new Error(`Cannot inspect ${file}: ${parsed.errors[0].message}`);
  }
  const program = parsed.program;
  const functions = localFunctions(program);
  const violations: Violation[] = [];
  let cases = 0;
  const lineStarts = [0];
  for (const match of source.matchAll(/\n/gu)) lineStarts.push(match.index + 1);
  const lineFor = (offset: number) => {
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
      if (node.type !== "CallExpression") return;
      const callee = runtimeExpression(node.callee);
      if (callee?.type !== "Identifier") return;
      const registration = callee.name;
      if (
        !TEST_REGISTRATIONS.has(registration) &&
        !CUCUMBER_REGISTRATIONS.has(registration)
      )
        return;

      const callback = functionArgument(node, functions);
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

export function inspectFeatureSource(
  source: string,
  file = "<feature>",
): Inspection {
  const violations: Violation[] = [];
  const lines = source.split("\n");
  let scenario: { line: number; name: string } | undefined;
  let scenarios = 0;
  let outcomeSteps = 0;
  let previousKeyword: string | undefined;

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

async function sourceFiles(directory: string): Promise<string[]> {
  const files: string[] = [];
  const entries = await readdir(directory, { withFileTypes: true });
  const names = new Set(entries.map((entry) => entry.name));
  for (const entry of entries) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...(await sourceFiles(path)));
    else if (entry.name.endsWith(".ts") && !entry.name.endsWith(".d.ts"))
      files.push(path);
    else if (
      entry.name.endsWith(".js") &&
      !names.has(entry.name.replace(/\.js$/u, ".ts"))
    )
      files.push(path);
  }
  return files;
}

async function main() {
  const root = join(__dirname, "..");
  const javascriptPaths = [
    ...(await sourceFiles(join(root, "test"))),
    ...(await sourceFiles(join(root, "features", "step_definitions"))),
  ].sort();
  const featurePaths = (await readdir(join(root, "features")))
    .filter((name) => name.endsWith(".feature.md"))
    .map((name) => join(root, "features", name))
    .sort();
  const results: Inspection[] = [];

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
