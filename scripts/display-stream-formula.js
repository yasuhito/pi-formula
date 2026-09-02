const { transformDisplayMath } = require("../dist/markdown.js");

const TARGET_START = "pi-formula-verify-target-start";
const TARGET_END = "pi-formula-verify-target-end";
const ESCAPE = String.fromCharCode(27);
const CSI_PATTERN = new RegExp(`${ESCAPE}\\[[0-?]*[ -/]*[@-~]`, "gu");

function stripTerminalControls(value) {
  const kittyStart = `${ESCAPE}_G`;
  const kittyEnd = `${ESCAPE}\\`;
  let stripped = value;
  for (let start = stripped.indexOf(kittyStart); start >= 0; ) {
    const end = stripped.indexOf(kittyEnd, start + kittyStart.length);
    if (end < 0) break;
    stripped = `${stripped.slice(0, start)}${stripped.slice(end + kittyEnd.length)}`;
    start = stripped.indexOf(kittyStart);
  }
  return stripped.replace(CSI_PATTERN, "");
}

function assistantMarkdown(message) {
  if (message?.role !== "assistant" || !Array.isArray(message.content))
    return "";
  return message.content
    .filter((item) => item.type === "text")
    .map((item) => item.text)
    .join("");
}

function findCompleteDisplayFormula(markdown) {
  let formula;
  transformDisplayMath(markdown, (_latex, original) => {
    formula ??= original;
    return original;
  });
  return formula;
}

function hasCompleteDisplayFormula(markdown, target) {
  let found = false;
  transformDisplayMath(markdown, (_latex, original) => {
    if (original === target) found = true;
    return original;
  });
  return found;
}

function advanceDisplayFormulaGate(readyFormula, message) {
  const markdown = assistantMarkdown(message);
  const nextFormula = readyFormula ?? findCompleteDisplayFormula(markdown);
  const hasReadyFormula =
    nextFormula !== undefined &&
    hasCompleteDisplayFormula(markdown, nextFormula);
  return {
    formulaToCapture: hasReadyFormula ? nextFormula : undefined,
    hasReadyFormula,
    readyFormula: nextFormula,
  };
}

function markTargetFormula(markdown, target) {
  return transformDisplayMath(markdown, (_latex, original) =>
    original === target ? `${TARGET_START}${original}${TARGET_END}` : original,
  );
}

function targetFitsViewport(markdown, availableWidth, terminalRows) {
  const start = markdown.indexOf(TARGET_START);
  if (
    start < 0 ||
    !Number.isFinite(availableWidth) ||
    availableWidth <= 0 ||
    !Number.isFinite(terminalRows) ||
    terminalRows <= 0
  )
    return false;
  const visible = stripTerminalControls(
    markdown
      .slice(start)
      .replaceAll(TARGET_START, "")
      .replaceAll(TARGET_END, ""),
  );
  const renderedRows = visible
    .split("\n")
    .reduce(
      (rows, line) =>
        rows +
        Math.max(2, 2 * Math.ceil(([...line].length * 2) / availableWidth)),
      0,
    );
  const reservedRows = Math.max(20, Math.ceil(terminalRows * 0.1));
  return renderedRows + reservedRows <= terminalRows;
}

function inspectTargetFormulaRendering(markdown) {
  const start = markdown.indexOf(TARGET_START);
  const end = markdown.indexOf(TARGET_END, start + TARGET_START.length);
  const target =
    start >= 0 && end >= 0
      ? markdown.slice(start + TARGET_START.length, end)
      : "";
  return {
    foundTarget: start >= 0 && end >= 0,
    markdown: markdown.replaceAll(TARGET_START, "").replaceAll(TARGET_END, ""),
    renderedAsImage: target.includes("\x1b_Ga=T,f=100"),
  };
}

module.exports = {
  advanceDisplayFormulaGate,
  findCompleteDisplayFormula,
  hasCompleteDisplayFormula,
  inspectTargetFormulaRendering,
  markTargetFormula,
  targetFitsViewport,
};
