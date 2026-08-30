import { existsSync, readFileSync } from "node:fs";

function macroName(value: string): string | undefined {
  const name = value.startsWith("\\") ? value.slice(1) : value;
  return /^[A-Za-z]+$/u.test(name) ? name : undefined;
}

function validDefinition(value: unknown): boolean {
  return typeof value === "string"
    || (Array.isArray(value)
      && value.length === 2
      && typeof value[0] === "string"
      && Number.isInteger(value[1])
      && value[1] >= 0
      && value[1] <= 9);
}

function parseObject(raw: string): Record<string, unknown> | undefined {
  try {
    const value: unknown = JSON.parse(raw);
    return value && typeof value === "object" && !Array.isArray(value)
      ? value as Record<string, unknown>
      : undefined;
  } catch {
    return undefined;
  }
}

function configuredMacros(configPath: string): Record<string, unknown> {
  if (!existsSync(configPath)) return {};
  try {
    const config = parseObject(readFileSync(configPath, "utf8"));
    const macros = config?.macros;
    return macros && typeof macros === "object" && !Array.isArray(macros)
      ? macros as Record<string, unknown>
      : {};
  } catch {
    return {};
  }
}

export function countConfiguredMacros(
  configPath: string,
  env: NodeJS.ProcessEnv
): number {
  const active = new Set<string>();
  for (const [rawName, definition] of Object.entries(configuredMacros(configPath))) {
    const name = macroName(rawName);
    if (name && validDefinition(definition)) active.add(name);
  }

  const environment = env.PI_FORMULA_MACROS === undefined
    ? undefined
    : parseObject(env.PI_FORMULA_MACROS);
  for (const [rawName, definition] of Object.entries(environment ?? {})) {
    const name = macroName(rawName);
    if (!name) continue;
    active.delete(name);
    if (validDefinition(definition)) active.add(name);
  }
  return active.size;
}
