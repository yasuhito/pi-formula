const fs = require("node:fs");
const { parseSync } = require("oxc-parser");

function propertyName(property) {
  if (property.key.type === "Identifier") return property.key.name;
  if (property.key.type === "Literal" && typeof property.key.value === "string")
    return property.key.value;
  return undefined;
}

function visit(node, callback) {
  if (!node || typeof node !== "object") return;
  callback(node);
  for (const value of Object.values(node)) {
    if (Array.isArray(value)) {
      for (const child of value) visit(child, callback);
    } else {
      visit(value, callback);
    }
  }
}

function findMacrosObject(program) {
  let macros;
  visit(program, (node) => {
    if (
      macros ||
      node.type !== "NewExpression" ||
      node.callee.type !== "Identifier" ||
      node.callee.name !== "TeX"
    )
      return;
    const options = node.arguments.find(
      (argument) => argument.type === "ObjectExpression",
    );
    const property = options?.properties.find(
      (candidate) =>
        candidate.type === "Property" && propertyName(candidate) === "macros",
    );
    if (property?.value.type === "ObjectExpression") macros = property.value;
  });
  return macros;
}

function literalValue(node, sourcePath) {
  if (node?.type === "Literal") return node.value;
  if (node?.type === "TemplateLiteral" && node.expressions.length === 0)
    return node.quasis[0].value.cooked;
  throw new Error(`qni-cli の追加マクロ値を解析できません: ${sourcePath}`);
}

function extractQniCliAdditionalMacros(source, sourcePath = "<source>") {
  const parsed = parseSync(sourcePath, source, { sourceType: "module" });
  if (parsed.errors.length > 0)
    throw new Error(`qni-cli の TypeScript を解析できません: ${sourcePath}`);
  const macrosObject = findMacrosObject(parsed.program);
  if (!macrosObject)
    throw new Error(`qni-cli の macros 定義が見つかりません: ${sourcePath}`);

  const macros = {};
  for (const property of macrosObject.properties) {
    if (property.type === "SpreadElement") continue;
    const name = propertyName(property);
    if (!name || property.value.type !== "ArrayExpression")
      throw new Error(
        `qni-cli の追加マクロ定義を解析できません: ${sourcePath}`,
      );
    const [replacementNode, parameterCountNode, ...extra] =
      property.value.elements;
    const replacement = literalValue(replacementNode, sourcePath);
    const parameterCount = literalValue(parameterCountNode, sourcePath);
    if (
      extra.length > 0 ||
      typeof replacement !== "string" ||
      !Number.isInteger(parameterCount)
    )
      throw new Error(
        `qni-cli の追加マクロ定義を解析できません: ${sourcePath}`,
      );
    macros[name] = [replacement, parameterCount];
  }
  return macros;
}

function readQniCliAdditionalMacros(sourcePath) {
  return extractQniCliAdditionalMacros(
    fs.readFileSync(sourcePath, "utf8"),
    sourcePath,
  );
}

module.exports = {
  extractQniCliAdditionalMacros,
  readQniCliAdditionalMacros,
};
