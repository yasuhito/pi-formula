import {
  type Node,
  type ObjectExpression,
  type ObjectProperty,
  type Program,
  parseSync,
  Visitor,
} from "oxc-parser";
import type { MacroDefinition } from "../dist/macros.js";

function propertyName(property: ObjectProperty) {
  if (property.key.type === "Identifier") return property.key.name;
  if (property.key.type === "Literal" && typeof property.key.value === "string")
    return property.key.value;
  return undefined;
}

function findMacrosObject(program: Program) {
  let macros: ObjectExpression | undefined;
  new Visitor({
    NewExpression(node) {
      if (
        macros ||
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
      if (
        property?.type === "Property" &&
        property.value.type === "ObjectExpression"
      )
        macros = property.value;
    },
  }).visit(program);
  return macros;
}

function objectExpression(node: Node | null | undefined) {
  const value = node?.type === "TSAsExpression" ? node.expression : node;
  return value?.type === "ObjectExpression" ? value : undefined;
}

function topLevelNamedObject(program: Program, name: string) {
  for (const statement of program.body) {
    const declaration =
      statement.type === "ExportNamedDeclaration"
        ? statement.declaration
        : statement;
    if (declaration?.type !== "VariableDeclaration") continue;
    const binding = declaration.declarations.find(
      (candidate) =>
        candidate.id.type === "Identifier" && candidate.id.name === name,
    );
    const object = objectExpression(binding?.init);
    if (object) return object;
  }
  return undefined;
}

function macroProperties(
  program: Program,
  macrosObject: ObjectExpression,
): ObjectProperty[] {
  return macrosObject.properties.flatMap((property) => {
    if (property.type !== "SpreadElement") return [property];
    if (property.argument.type !== "Identifier") return [];
    const spreadObject = topLevelNamedObject(program, property.argument.name);
    return (
      spreadObject?.properties.filter(
        (candidate) => candidate.type !== "SpreadElement",
      ) ?? []
    );
  });
}

function literalValue(
  node: Node | null | undefined,
  sourcePath: string,
): unknown {
  if (node?.type === "Literal") return node.value;
  if (node?.type === "TemplateLiteral" && node.expressions.length === 0)
    return node.quasis[0].value.cooked;
  throw new Error(`qni-cli の追加マクロ値を解析できません: ${sourcePath}`);
}

function extractQniCliAdditionalMacros(
  source: string,
  sourcePath = "<source>",
) {
  const parsed = parseSync(sourcePath, source, { sourceType: "module" });
  if (parsed.errors.length > 0)
    throw new Error(`qni-cli の TypeScript を解析できません: ${sourcePath}`);
  const macrosObject =
    findMacrosObject(parsed.program) ??
    topLevelNamedObject(parsed.program, "quantumMacros");
  if (!macrosObject)
    throw new Error(`qni-cli の macros 定義が見つかりません: ${sourcePath}`);

  const macros: Record<string, MacroDefinition> = {};
  for (const property of macroProperties(parsed.program, macrosObject)) {
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
      typeof parameterCount !== "number" ||
      !Number.isInteger(parameterCount)
    )
      throw new Error(
        `qni-cli の追加マクロ定義を解析できません: ${sourcePath}`,
      );
    macros[name] = [replacement, parameterCount];
  }
  return macros;
}

export { extractQniCliAdditionalMacros };
