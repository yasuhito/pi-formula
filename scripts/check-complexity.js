const { readFile, readdir } = require("node:fs/promises");
const { join, relative } = require("node:path");

const MAX_CYCLOMATIC_COMPLEXITY = 23;
const DISPLAY_LIMIT = 10;
const root = join(__dirname, "..");
const sourceDirectory = join(root, "src");

async function main() {
  const { analyzeFileComplexity } = await import(
    "oxlint-plugin-complexity/standalone"
  );
  const sourceFiles = (await readdir(sourceDirectory, { withFileTypes: true }))
    .filter(
      (entry) =>
        entry.isFile() &&
        entry.name.endsWith(".ts") &&
        !entry.name.endsWith(".d.ts"),
    )
    .map((entry) => join(sourceDirectory, entry.name))
    .sort();

  const functions = [];
  for (const filePath of sourceFiles) {
    const code = await readFile(filePath, "utf8");
    const result = analyzeFileComplexity(code, relative(root, filePath));
    for (const fn of result.functions) {
      functions.push({
        ...fn,
        file: relative(root, filePath),
      });
    }
  }

  functions.sort(
    (left, right) =>
      right.cyclomatic - left.cyclomatic ||
      left.file.localeCompare(right.file) ||
      left.startLine - right.startLine,
  );

  const total = functions.reduce((sum, fn) => sum + fn.cyclomatic, 0);
  const maximum = functions.at(0)?.cyclomatic ?? 0;
  const average = functions.length === 0 ? 0 : total / functions.length;
  const bands = [
    ["1-5", functions.filter((fn) => fn.cyclomatic <= 5).length],
    [
      "6-10",
      functions.filter((fn) => fn.cyclomatic >= 6 && fn.cyclomatic <= 10)
        .length,
    ],
    [
      "11-20",
      functions.filter((fn) => fn.cyclomatic >= 11 && fn.cyclomatic <= 20)
        .length,
    ],
    ["21+", functions.filter((fn) => fn.cyclomatic >= 21).length],
  ];

  console.log(
    `Cyclomatic complexity: ${functions.length} functions, ` +
      `maximum ${maximum}, average ${average.toFixed(2)}`,
  );
  console.log(`Maximum allowed per function: ${MAX_CYCLOMATIC_COMPLEXITY}`);
  console.log(
    `Distribution: ${bands.map(([label, count]) => `${label}: ${count}`).join(", ")}`,
  );
  console.log("Highest-complexity functions:");
  for (const fn of functions.slice(0, DISPLAY_LIMIT)) {
    console.log(
      `  ${String(fn.cyclomatic).padStart(2)}  ` +
        `${fn.file}:${fn.startLine}  ${fn.name}`,
    );
  }

  const violations = functions.filter(
    (fn) => fn.cyclomatic > MAX_CYCLOMATIC_COMPLEXITY,
  );
  if (violations.length > 0) {
    console.error(
      `${violations.length} function(s) exceed ` +
        `the maximum cyclomatic complexity:`,
    );
    for (const fn of violations) {
      console.error(
        `  ${fn.file}:${fn.startLine} ${fn.name}: ${fn.cyclomatic}`,
      );
    }
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
