const assert = require("node:assert/strict");
const test = require("node:test");

const { FormulaImageRenderer } = require("../dist/formula-image-renderer.js");

const options = {
  availableWidth: 80,
  color: "#d4d4d4",
  macros: {},
};

function typesetImage() {
  return {
    svg: "<svg></svg>",
    png: Buffer.from("png"),
    scale: 1,
    widthPx: 8,
    heightPx: 16,
    columns: 1,
    rows: 1,
  };
}

function failedPlacement() {
  let placementAttempts = 0;
  const renderer = new FormulaImageRenderer({
    getCellDimensions: () => ({ widthPx: 8, heightPx: 16 }),
    typesetMath: typesetImage,
    stableImageId: () => 1,
    encodeTransfer: () => "transfer",
    encodePlaceholderRows: () => {
      placementAttempts += 1;
      throw new Error("injected placement failure");
    },
  });
  const render = renderer.createMarkdownRenderer(options);
  const original = "$$x$$";
  const first = render("x", original);
  const second = render("x", original);
  return {
    first,
    second,
    original,
    placementAttempts,
    stats: renderer.stats(),
  };
}

test("a placement failure keeps the original formula", () => {
  const result = failedPlacement();

  assert.equal(result.first, result.original);
});

test("a cached placement failure keeps the original formula", () => {
  const result = failedPlacement();

  assert.equal(result.second, result.original);
});

test("a cached placement failure is not attempted again", () => {
  const result = failedPlacement();

  assert.equal(result.placementAttempts, 1);
});

test("a placement failure is visible in image renderer statistics", () => {
  const result = failedPlacement();

  assert.equal(result.stats.lastFailure, "placement failed");
});

test("a placement failure does not prevent the following formula", () => {
  let placementAttempts = 0;
  const renderer = new FormulaImageRenderer({
    getCellDimensions: () => ({ widthPx: 8, heightPx: 16 }),
    typesetMath: typesetImage,
    stableImageId: () => 1,
    encodeTransfer: () => "transfer",
    encodePlaceholderRows: () => {
      placementAttempts += 1;
      if (placementAttempts === 1) {
        throw new Error("injected placement failure");
      }
      return ["placeholder"];
    },
  });
  const render = renderer.createMarkdownRenderer(options);
  render("broken", "$$broken$$");

  assert.equal(render("valid", "$$valid$$"), "transfer\x1b[0m\n\nplaceholder");
});
