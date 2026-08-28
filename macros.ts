import { existsSync, readFileSync } from "node:fs";

export type MathMacroDefinition = string | readonly [replacement: string, argumentsCount: number];
export type MathMacros = Readonly<Record<string, MathMacroDefinition>>;

export interface LoadedMathMacros {
  macros: MathMacros;
  error?: string;
}

const RESERVED_MACROS = new Set(["ket", "bra", "braket"]);

function invalidParameterReference(replacement: string, argumentsCount: number): string | undefined {
  for (let index = 0; index < replacement.length; index += 1) {
    if (replacement[index] !== "#") continue;
    const reference = replacement[index + 1];
    if (reference === "#") {
      index += 1;
      continue;
    }
    const number = reference ? Number.parseInt(reference, 10) : Number.NaN;
    if (number >= 1 && number <= argumentsCount && reference === String(number)) {
      index += 1;
      continue;
    }
    return reference ? `#${reference}` : "#";
  }
  return undefined;
}

function normalizeMacros(value: unknown, source: string): LoadedMathMacros {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { macros: {}, error: `${source}: マクロ定義は JSON オブジェクトにしてください` };
  }

  const macros: Record<string, MathMacroDefinition> = {};
  for (const [rawName, definition] of Object.entries(value)) {
    const name = rawName.startsWith("\\") ? rawName.slice(1) : rawName;
    if (!/^[A-Za-z]+$/u.test(name)) {
      return { macros: {}, error: `${source}: マクロ名 ${rawName} は英字だけにしてください` };
    }
    if (RESERVED_MACROS.has(name)) {
      return { macros: {}, error: `${source}: 既定マクロ \\${name} は変更できません` };
    }
    let normalized: MathMacroDefinition;
    if (typeof definition === "string") {
      normalized = definition;
    } else if (Array.isArray(definition)
        && definition.length === 2
        && typeof definition[0] === "string"
        && Number.isInteger(definition[1])
        && definition[1] >= 0
        && definition[1] <= 9) {
      normalized = [definition[0], definition[1]];
    } else {
      return {
        macros: {},
        error: `${source}: \\${name} は文字列または [置換文字列, 引数の数] にしてください`
      };
    }
    const [replacement, argumentsCount] = typeof normalized === "string"
      ? [normalized, 0] as const
      : normalized;
    const invalidReference = invalidParameterReference(replacement, argumentsCount);
    if (invalidReference) {
      return {
        macros: {},
        error: `${source}: \\${name} の ${invalidReference} は引数の数を超えています`
      };
    }
    macros[name] = normalized;
  }
  return { macros };
}

function parseJson(raw: string, source: string): { value?: unknown; error?: string } {
  try {
    return { value: JSON.parse(raw) };
  } catch {
    return { error: `${source}: JSON を解析できません` };
  }
}

function macrosFromConfig(configPath: string): LoadedMathMacros {
  if (!existsSync(configPath)) return { macros: {} };
  const parsed = parseJson(readFileSync(configPath, "utf8"), "設定ファイル");
  if (parsed.error) return { macros: {}, error: parsed.error };
  const config = parsed.value;
  if (!config || typeof config !== "object" || Array.isArray(config)) {
    return { macros: {}, error: "設定ファイル: JSON オブジェクトにしてください" };
  }
  const value = (config as { macros?: unknown }).macros;
  return value === undefined ? { macros: {} } : normalizeMacros(value, "設定ファイル macros");
}

function macrosFromEnvironment(env: NodeJS.ProcessEnv): LoadedMathMacros {
  const raw = env.QNI_MATH_MACROS;
  if (raw === undefined) return { macros: {} };
  const parsed = parseJson(raw, "環境変数 QNI_MATH_MACROS");
  if (parsed.error) return { macros: {}, error: parsed.error };
  return normalizeMacros(parsed.value, "環境変数 QNI_MATH_MACROS");
}

export function loadMathMacros(configPath: string, env: NodeJS.ProcessEnv): LoadedMathMacros {
  const configured = macrosFromConfig(configPath);
  const environment = macrosFromEnvironment(env);
  const errors = [configured.error, environment.error].filter((error): error is string => Boolean(error));
  return errors.length === 0
    ? { macros: { ...configured.macros, ...environment.macros } }
    : { macros: {}, error: errors.join("; ") };
}
