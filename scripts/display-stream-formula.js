const { transformDisplayMath } = require("../dist/markdown.js");

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

function advanceDisplayFormulaGate(readyFormula, message) {
  const markdown = assistantMarkdown(message);
  return {
    formulaToCapture: readyFormula,
    readyFormula: readyFormula ?? findCompleteDisplayFormula(markdown),
  };
}

module.exports = { advanceDisplayFormulaGate, findCompleteDisplayFormula };
