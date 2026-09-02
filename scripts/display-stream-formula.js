const { transformDisplayMath } = require("../dist/markdown.js");

const TARGET_START = "pi-formula-verify-target-start";
const TARGET_END = "pi-formula-verify-target-end";

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
  return {
    formulaToCapture: readyFormula,
    hasReadyFormula:
      readyFormula !== undefined &&
      hasCompleteDisplayFormula(markdown, readyFormula),
    readyFormula: readyFormula ?? findCompleteDisplayFormula(markdown),
  };
}

function markTargetFormula(markdown, target) {
  return transformDisplayMath(markdown, (_latex, original) =>
    original === target ? `${TARGET_START}${original}${TARGET_END}` : original,
  );
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
};
