import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

import type {
  DisplayPlan,
  DisplayRunFiles,
  DisplayVerificationOptions,
} from "./display-verification-contract";

const SHELL_DOLLAR = "$";

function shellQuote(value: string): string {
  return `'${value.replaceAll("'", `'\\''`)}'`;
}

function environmentLines(values: Record<string, string>): string {
  return Object.entries(values)
    .map(([name, value]) => `${name}=${shellQuote(value)}`)
    .join("\n");
}

function terminalConfiguration(options: DisplayVerificationOptions): string {
  const colors =
    options.theme === "light"
      ? { background: "#faf8f0", foreground: "#282823" }
      : { background: "#15181c", foreground: "#e6e1d7" };
  if (options.terminal === "ghostty") {
    return [
      "font-size = 12",
      "window-decoration = false",
      "window-padding-x = 8",
      "window-padding-y = 8",
      `background = ${colors.background}`,
      `foreground = ${colors.foreground}`,
      "background-opacity = 1",
      "scrollbar = never",
    ].join("\n");
  }
  return [
    "font_size 12",
    "hide_window_decorations yes",
    "window_padding_width 8",
    `background ${colors.background}`,
    `foreground ${colors.foreground}`,
    "background_opacity 1",
    "scrollback_lines 10000",
    "enable_audio_bell no",
    "confirm_os_window_close 0",
  ].join("\n");
}

function runnerSource(
  options: DisplayVerificationOptions,
  files: DisplayRunFiles,
  height: number,
  root: string,
): string {
  const values = environmentLines({
    PI_FORMULA_VERIFY_SESSION: files.session,
    PI_FORMULA_VERIFY_CORPUS: options.corpus,
    PI_FORMULA_VERIFY_EXTENSION: options.extension,
    PI_FORMULA_VERIFY_MACROS_EXTENSION: join(
      root,
      "scripts/verify-extensions/pi-formula-verify-macros.ts",
    ),
    PI_FORMULA_VERIFY_PATH_EXTENSION: join(
      root,
      "scripts/verify-extensions/pi-formula-verify-image-path.ts",
    ),
    PI_FORMULA_VERIFY_THEME:
      options.theme === "light"
        ? join(root, "scripts/verify-display-theme.json")
        : join(root, "scripts/verify-display-theme-dark.json"),
    PI_FORMULA_VERIFY_CONFIG_HOME: files.configHome,
    PI_FORMULA_VERIFY_IMAGE_MARKER: files.pathMarker,
    PI_FORMULA_VERIFY_HEIGHT: String(height),
  });
  return `#!/usr/bin/env bash
set -Eeuo pipefail
${values}
export XDG_CONFIG_HOME="$PI_FORMULA_VERIFY_CONFIG_HOME"
export PI_FORMULA_MACROS='{}' PI_FORMULA_VERIFY_HEIGHT PI_FORMULA_VERIFY_IMAGE_MARKER
unset TMUX STY
args=(--name pi-formula-verify --session "$PI_FORMULA_VERIFY_SESSION" --no-extensions
  --extension "$PI_FORMULA_VERIFY_EXTENSION"
  --extension "$PI_FORMULA_VERIFY_MACROS_EXTENSION"
  --extension "$PI_FORMULA_VERIFY_PATH_EXTENSION"
  --no-themes --theme "$PI_FORMULA_VERIFY_THEME" --use-theme pi-formula-verify
  --no-skills --no-prompt-templates --no-context-files --no-tools --approve
  --thinking off --system-prompt '添付された Markdown だけを、一字一句そのまま出力してください。')
exec pi "${SHELL_DOLLAR}{args[@]}" "@$PI_FORMULA_VERIFY_CORPUS" '次の Markdown を一字一句そのまま出力してください。'
`;
}

function launcherSource(
  options: DisplayVerificationOptions,
  files: DisplayRunFiles,
  plan: DisplayPlan,
): string {
  const values = environmentLines({
    VERIFY_HEIGHT: String(plan.height),
    VERIFY_WIDTH: String(plan.initialWidth),
    DISPLAY_FILE: files.display,
    OUTPUT_FILE: files.output,
    TERMINAL_CONFIG: files.terminalConfig,
    RUNNER: files.runner,
  });
  const launch =
    options.terminal === "ghostty"
      ? 'exec ghostty --config-default-files=false --gtk-single-instance=false --title=pi-formula-verify --config-file="$TERMINAL_CONFIG" -e "$RUNNER"'
      : 'exec kitty --config "$TERMINAL_CONFIG" --title pi-formula-verify "$RUNNER"';
  return `#!/usr/bin/env bash
set -Eeuo pipefail
${values}
output=$(wlr-randr | grep -oE '^[A-Za-z0-9-]+' | head -1)
[[ -n "$output" ]]
wlr-randr --output "$output" --custom-mode "${SHELL_DOLLAR}{VERIFY_WIDTH}x${SHELL_DOLLAR}{VERIFY_HEIGHT}"
printf '%s\n' "$WAYLAND_DISPLAY" >"$DISPLAY_FILE.tmp"
mv "$DISPLAY_FILE.tmp" "$DISPLAY_FILE"
printf '%s\n' "$output" >"$OUTPUT_FILE.tmp"
mv "$OUTPUT_FILE.tmp" "$OUTPUT_FILE"
${launch}
`;
}

export async function writeDisplayRuntime(
  options: DisplayVerificationOptions,
  files: DisplayRunFiles,
  plan: DisplayPlan,
  root: string,
): Promise<void> {
  if (options.path === "text") {
    const configDirectory = join(files.configHome, "pi-formula");
    await mkdir(configDirectory, { recursive: true });
    await writeFile(join(configDirectory, "config.json"), '{"path":"text"}\n');
  }
  await writeFile(files.terminalConfig, `${terminalConfiguration(options)}\n`);
  await writeFile(
    files.runner,
    runnerSource(options, files, plan.height, root),
    { mode: 0o755 },
  );
  await writeFile(files.launcher, launcherSource(options, files, plan), {
    mode: 0o755,
  });
}
