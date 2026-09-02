import {
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { homedir } from "node:os";
import { dirname, isAbsolute, join } from "node:path";

import { type FormulaMacros, resolveUserMacros } from "./macros";

export type FormulaPathMode = "auto" | "image" | "text";

export interface LoadedFormulaConfig {
  filePath: string;
  defaultPath: "image" | "text" | undefined;
  macros: FormulaMacros;
  errors: readonly string[];
}

interface ParsedConfig {
  value: Record<string, unknown>;
  errors: string[];
}

export function formulaConfigPath(env: NodeJS.ProcessEnv): string {
  const base =
    env.XDG_CONFIG_HOME && isAbsolute(env.XDG_CONFIG_HOME)
      ? env.XDG_CONFIG_HOME
      : (env.HOME ? join(env.HOME, ".config") : undefined) ||
        (env.USERPROFILE ? join(env.USERPROFILE, ".config") : undefined) ||
        join(homedir(), ".config");
  return join(base, "pi-formula", "config.json");
}

function readConfig(path: string): ParsedConfig {
  if (!existsSync(path)) return { value: {}, errors: [] };
  let raw: string;
  try {
    raw = readFileSync(path, "utf8");
  } catch (error) {
    return {
      value: {},
      errors: [
        `XDG config: ${error instanceof Error ? error.message : String(error)}`,
      ],
    };
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { value: {}, errors: ["XDG config: invalid JSON"] };
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return {
      value: {},
      errors: ["XDG config: config must be a JSON object"],
    };
  }
  return { value: parsed as Record<string, unknown>, errors: [] };
}

export function loadFormulaConfig(env: NodeJS.ProcessEnv): LoadedFormulaConfig {
  const filePath = formulaConfigPath(env);
  const parsed = readConfig(filePath);
  const loadedMacros = resolveUserMacros(
    parsed.value.macros,
    env.PI_FORMULA_MACROS,
  );
  const path = parsed.value.path;
  return {
    filePath,
    defaultPath: path === "image" || path === "text" ? path : undefined,
    macros: loadedMacros.macros,
    errors: [...parsed.errors, ...loadedMacros.errors],
  };
}

export function saveDefaultPath(
  path: string,
  mode: FormulaPathMode,
): "image" | "text" | undefined {
  let config: Record<string, unknown> = {};
  if (existsSync(path)) {
    const parsed: unknown = JSON.parse(readFileSync(path, "utf8"));
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new Error("pi-formula config must be a JSON object");
    }
    config = parsed as Record<string, unknown>;
  }

  if (mode === "auto") delete config.path;
  else config.path = mode;

  if (Object.keys(config).length === 0) {
    rmSync(path, { force: true });
    return undefined;
  }

  mkdirSync(dirname(path), { recursive: true });
  const temporary = `${path}.${process.pid}.tmp`;
  writeFileSync(temporary, `${JSON.stringify(config, null, 2)}\n`, {
    mode: 0o600,
  });
  try {
    renameSync(temporary, path);
  } catch (error) {
    rmSync(temporary, { force: true });
    throw error;
  }
  return mode === "auto" ? undefined : mode;
}
