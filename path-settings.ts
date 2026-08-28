import { existsSync, readFileSync, renameSync, rmSync, writeFileSync, mkdirSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";

export type MathPathMode = "auto" | "image" | "text";

export function mathConfigPath(env: NodeJS.ProcessEnv): string {
  const base = env.XDG_CONFIG_HOME
    ?? (env.HOME ? join(env.HOME, ".config") : undefined)
    ?? (env.USERPROFILE ? join(env.USERPROFILE, ".config") : undefined)
    ?? join(homedir(), ".config");
  return join(base, "qni-cli", "qni-math.json");
}

export function readDefaultPath(path: string): "image" | "text" | undefined {
  if (!existsSync(path)) return undefined;
  try {
    const value = JSON.parse(readFileSync(path, "utf8")) as { path?: unknown };
    return value.path === "image" || value.path === "text" ? value.path : undefined;
  } catch {
    return undefined;
  }
}

export function writeDefaultPath(path: string, mode: MathPathMode): void {
  let config: Record<string, unknown> = {};
  if (existsSync(path)) {
    try {
      const parsed = JSON.parse(readFileSync(path, "utf8"));
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        config = parsed as Record<string, unknown>;
      }
    } catch {
      config = {};
    }
  }

  if (mode === "auto") delete config.path;
  else config.path = mode;

  if (Object.keys(config).length === 0) {
    rmSync(path, { force: true });
    return;
  }

  mkdirSync(dirname(path), { recursive: true });
  const temporary = `${path}.${process.pid}.tmp`;
  writeFileSync(temporary, `${JSON.stringify(config, null, 2)}\n`, { mode: 0o600 });
  renameSync(temporary, path);
}
