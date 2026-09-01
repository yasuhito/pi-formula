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

export type FormulaPathMode = "auto" | "image" | "text";

export function formulaConfigPath(env: NodeJS.ProcessEnv): string {
  const base =
    env.XDG_CONFIG_HOME && isAbsolute(env.XDG_CONFIG_HOME)
      ? env.XDG_CONFIG_HOME
      : (env.HOME ? join(env.HOME, ".config") : undefined) ||
        (env.USERPROFILE ? join(env.USERPROFILE, ".config") : undefined) ||
        join(homedir(), ".config");
  return join(base, "pi-formula", "config.json");
}

export function readDefaultPath(path: string): "image" | "text" | undefined {
  if (!existsSync(path)) return undefined;
  try {
    const value = JSON.parse(readFileSync(path, "utf8")) as { path?: unknown };
    return value.path === "image" || value.path === "text"
      ? value.path
      : undefined;
  } catch {
    return undefined;
  }
}

export function writeDefaultPath(path: string, mode: FormulaPathMode): void {
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
    return;
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
}
