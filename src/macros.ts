export type MacroDefinition =
  | string
  | readonly [replacement: string, argumentsCount: number];
export type FormulaMacros = Readonly<Record<string, MacroDefinition>>;

interface NormalizedMacros {
  macros: Record<string, MacroDefinition>;
  errors: string[];
}

export interface LoadedUserMacros {
  macros: FormulaMacros;
  errors: readonly string[];
}

interface MacroArgument {
  value: string;
  end: number;
}

const MAX_INLINE_MACRO_EXPANSIONS = 1_000;
const MAX_INLINE_EXPANDED_LENGTH = 16_384;

function macroArgument(
  source: string,
  start: number,
): MacroArgument | undefined {
  let index = start;
  while (/\s/u.test(source[index] ?? "")) index += 1;
  if (index >= source.length) return undefined;

  if (source[index] !== "{") {
    if (source[index] !== "\\") {
      return { value: source[index], end: index + 1 };
    }
    const controlSequence = /^\\(?:[A-Za-z]+|.)/u.exec(source.slice(index));
    if (!controlSequence) return undefined;
    return {
      value: controlSequence[0],
      end: index + controlSequence[0].length,
    };
  }

  let depth = 1;
  for (let cursor = index + 1; cursor < source.length; cursor += 1) {
    if (source[cursor] === "{" && !escapedAt(source, cursor)) depth += 1;
    if (source[cursor] !== "}" || escapedAt(source, cursor)) continue;
    depth -= 1;
    if (depth === 0) {
      return { value: source.slice(index + 1, cursor), end: cursor + 1 };
    }
  }
  return undefined;
}

function escapedAt(source: string, index: number): boolean {
  let backslashes = 0;
  for (
    let cursor = index - 1;
    cursor >= 0 && source[cursor] === "\\";
    cursor -= 1
  ) {
    backslashes += 1;
  }
  return backslashes % 2 === 1;
}

function substituteArguments(
  replacement: string,
  arguments_: readonly string[],
): string {
  let substituted = "";
  for (let index = 0; index < replacement.length; index += 1) {
    const argumentIndex = Number.parseInt(replacement[index + 1] ?? "", 10);
    if (
      replacement[index] === "#" &&
      !escapedAt(replacement, index) &&
      argumentIndex >= 1 &&
      argumentIndex <= arguments_.length
    ) {
      substituted += `{${arguments_[argumentIndex - 1]}}`;
      index += 1;
    } else {
      substituted += replacement[index];
    }
  }
  return substituted;
}

function expandMacros(
  source: string,
  macros: FormulaMacros,
  active: ReadonlySet<string>,
  budget: { remaining: number },
): string | undefined {
  let expanded = "";
  for (let index = 0; index < source.length; ) {
    const command = /^\\([A-Za-z]+)/u.exec(source.slice(index));
    const name = command?.[1];
    const definition = name ? macros[name] : undefined;
    if (!command || !name || definition === undefined || active.has(name)) {
      expanded += source[index];
      index += 1;
      continue;
    }

    const [replacement, argumentsCount] =
      typeof definition === "string" ? ([definition, 0] as const) : definition;
    const arguments_: string[] = [];
    let end = index + command[0].length;
    for (let argument = 0; argument < argumentsCount; argument += 1) {
      const parsed = macroArgument(source, end);
      if (!parsed) break;
      arguments_.push(parsed.value);
      end = parsed.end;
    }
    if (arguments_.length !== argumentsCount) {
      expanded += command[0];
      index += command[0].length;
      continue;
    }

    budget.remaining -= 1;
    if (budget.remaining < 0) return undefined;
    const nested = expandMacros(
      substituteArguments(replacement, arguments_),
      macros,
      new Set([...active, name]),
      budget,
    );
    if (nested === undefined) return undefined;
    expanded += nested;
    if (expanded.length > MAX_INLINE_EXPANDED_LENGTH) return undefined;
    index = end;
  }
  return expanded;
}

export function expandFormulaMacros(
  source: string,
  macros: FormulaMacros,
): string {
  if (Object.keys(macros).length === 0) return source;
  return (
    expandMacros(source, macros, new Set(), {
      remaining: MAX_INLINE_MACRO_EXPANSIONS,
    }) ?? source
  );
}

function invalidParameterReference(
  replacement: string,
  argumentsCount: number,
): string | undefined {
  for (let index = 0; index < replacement.length; index += 1) {
    if (replacement[index] !== "#") continue;
    let backslashes = 0;
    for (
      let cursor = index - 1;
      cursor >= 0 && replacement[cursor] === "\\";
      cursor -= 1
    ) {
      backslashes += 1;
    }
    if (backslashes % 2 === 1) continue;

    const reference = replacement[index + 1];
    const number = reference ? Number.parseInt(reference, 10) : Number.NaN;
    if (
      number >= 1 &&
      number <= argumentsCount &&
      reference === String(number)
    ) {
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
      errors: [`${source}: macro definitions must be a JSON object`],
    };
  }

  const result: NormalizedMacros = {
    macros: {},
    errors: [],
  };
  for (const [rawName, definition] of Object.entries(value)) {
    const name = normalizedName(rawName);
    if (!name) {
      result.errors.push(
        `${source}: macro name ${rawName} must contain only letters`,
      );
      continue;
    }

    let normalized: MacroDefinition | undefined;
    if (typeof definition === "string") {
      normalized = definition;
    } else if (
      Array.isArray(definition) &&
      definition.length === 2 &&
      typeof definition[0] === "string" &&
      Number.isInteger(definition[1]) &&
      definition[1] >= 0 &&
      definition[1] <= 9
    ) {
      normalized = [definition[0], definition[1]];
    }
    if (normalized === undefined) {
      result.errors.push(
        `${source}: \\${name} must be a string or [replacement, argument count]`,
      );
      continue;
    }

    const [replacement, argumentsCount] =
      typeof normalized === "string" ? ([normalized, 0] as const) : normalized;
    const invalidReference = invalidParameterReference(
      replacement,
      argumentsCount,
    );
    if (invalidReference) {
      result.errors.push(
        `${source}: ${invalidReference} in \\${name} exceeds its argument count`,
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
    return {
      macros: {},
      errors: [`${source}: invalid JSON`],
    };
  }
  return normalizeMacros(value, source);
}

export function resolveUserMacros(
  configuredValue: unknown,
  environmentValue: string | undefined,
): LoadedUserMacros {
  const configured =
    configuredValue === undefined
      ? { macros: {}, errors: [] }
      : normalizeMacros(configuredValue, "XDG config macros");
  const environment =
    environmentValue === undefined
      ? { macros: {}, errors: [] }
      : parseSource(environmentValue, "PI_FORMULA_MACROS");
  const macros: Record<string, MacroDefinition> = { ...configured.macros };
  Object.assign(macros, environment.macros);
  return { macros, errors: [...configured.errors, ...environment.errors] };
}

export function validateAdditionalMacros(
  macros: FormulaMacros,
): Record<string, MacroDefinition> {
  const normalized = normalizeMacros(macros, "additional macros");
  if (normalized.errors.length > 0)
    throw new TypeError(normalized.errors.join("; "));
  return normalized.macros;
}
