import { existsSync, readFileSync } from "node:fs";
import { formulaConfigPath } from "./path-settings";

export type MacroDefinition = string | readonly [replacement: string, argumentsCount: number];
export type FormulaMacros = Readonly<Record<string, MacroDefinition>>;

interface NormalizedMacros {
  macros: Record<string, MacroDefinition>;
  rejected: Set<string>;
  errors: string[];
}

export interface LoadedUserMacros {
  macros: FormulaMacros;
  errors: readonly string[];
}

function invalidParameterReference(
  replacement: string,
  argumentsCount: number
): string | undefined {
  for (let index = 0; index < replacement.length; index += 1) {
    if (replacement[index] !== "#") continue;
    let backslashes = 0;
    for (let cursor = index - 1; cursor >= 0 && replacement[cursor] === "\\"; cursor -= 1) {
      backslashes += 1;
    }
    if (backslashes % 2 === 1) continue;

    const reference = replacement[index + 1];
    const number = reference ? Number.parseInt(reference, 10) : Number.NaN;
    if (number >= 1 && number <= argumentsCount && reference === String(number)) {
      index += 1;
      continue;
    }
    return reference ? `#${reference}` : "#";
  }
  return undefined;
}

function normalizedName(rawName: string): string | undefined {
  const name = rawName.startsWith("\\") ? rawName.slice(1) : rawName;
  return /^[A-Za-z]+$/u.test(name) ? name : undefined;
}

function normalizeMacros(value: unknown, source: string): NormalizedMacros {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {
      macros: {},
      rejected: new Set(),
      errors: [`${source}: macro definitions must be a JSON object`]
    };
  }

  const result: NormalizedMacros = { macros: {}, rejected: new Set(), errors: [] };
  for (const [rawName, definition] of Object.entries(value)) {
    const name = normalizedName(rawName);
    if (!name) {
      result.errors.push(`${source}: macro name ${rawName} must contain only letters`);
      continue;
    }

    let normalized: MacroDefinition | undefined;
    if (typeof definition === "string") {
      normalized = definition;
    } else if (
      Array.isArray(definition)
      && definition.length === 2
      && typeof definition[0] === "string"
      && Number.isInteger(definition[1])
      && definition[1] >= 0
      && definition[1] <= 9
    ) {
      normalized = [definition[0], definition[1]];
    }
    if (normalized === undefined) {
      result.rejected.add(name);
      result.errors.push(
        `${source}: \\${name} must be a string or [replacement, argument count]`
      );
      continue;
    }

    const [replacement, argumentsCount] = typeof normalized === "string"
      ? [normalized, 0] as const
      : normalized;
    const invalidReference = invalidParameterReference(replacement, argumentsCount);
    if (invalidReference) {
      result.rejected.add(name);
      result.errors.push(
        `${source}: ${invalidReference} in \\${name} exceeds its argument count`
      );
      continue;
    }
    result.macros[name] = normalized;
  }
  return result;
}

function parseSource(raw: string, source: string): NormalizedMacros {
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return { macros: {}, rejected: new Set(), errors: [`${source}: invalid JSON`] };
  }
  return normalizeMacros(value, source);
}

function configMacros(env: NodeJS.ProcessEnv): NormalizedMacros {
  const path = formulaConfigPath(env);
  if (!existsSync(path)) return { macros: {}, rejected: new Set(), errors: [] };
  let raw: string;
  try {
    raw = readFileSync(path, "utf8");
  } catch (error) {
    return {
      macros: {},
      rejected: new Set(),
      errors: [`XDG config: ${error instanceof Error ? error.message : String(error)}`]
    };
  }
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return { macros: {}, rejected: new Set(), errors: ["XDG config: invalid JSON"] };
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {
      macros: {}, rejected: new Set(), errors: ["XDG config: config must be a JSON object"]
    };
  }
  const macros = (value as { macros?: unknown }).macros;
  return macros === undefined
    ? { macros: {}, rejected: new Set(), errors: [] }
    : normalizeMacros(macros, "XDG config macros");
}

export function loadUserMacros(env: NodeJS.ProcessEnv): LoadedUserMacros {
  const configured = configMacros(env);
  const environment = env.PI_FORMULA_MACROS === undefined
    ? { macros: {}, rejected: new Set<string>(), errors: [] }
    : parseSource(env.PI_FORMULA_MACROS, "PI_FORMULA_MACROS");
  const macros: Record<string, MacroDefinition> = { ...configured.macros };
  Object.assign(macros, environment.macros);
  return { macros, errors: [...configured.errors, ...environment.errors] };
}

export function validateAdditionalMacros(macros: FormulaMacros): Record<string, MacroDefinition> {
  const normalized = normalizeMacros(macros, "additional macros");
  if (normalized.errors.length > 0) throw new TypeError(normalized.errors.join("; "));
  return normalized.macros;
}
