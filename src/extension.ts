import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent" with { "resolution-mode": "import" };

const { getCellDimensions } = require("@earendil-works/pi-tui") as {
  getCellDimensions(): { widthPx: number; heightPx: number };
};

import { encodePlaceholderRows, encodeTransfer, stableImageId } from "./kitty";
import { countConfiguredMacros } from "./macro-settings";
import { transformDisplayMath } from "./markdown";
import {
  formulaConfigPath,
  readDefaultPath,
  writeDefaultPath,
  type FormulaPathMode
} from "./path-settings";
import { RenderCache } from "./render-cache";
import { multiplexerProbeResult, probePngSupport, type TerminalProbe } from "./terminal-probe";
import { typesetMath, type TypesetImage } from "./typesetter";

const manifest = JSON.parse(
  readFileSync(resolve(__dirname, "../package.json"), "utf8")
) as { version?: unknown };
if (typeof manifest.version !== "string") {
  throw new Error("pi-formula could not read its package version");
}

const MAX_CACHE_ENTRIES = 64;
const MAX_LATEX_LENGTH = 16_384;
const PATH_ENTRY = "pi-formula-path";
const REGISTRATION_KEY = Symbol.for("pi-formula.registered");
const imageCache = new RenderCache(MAX_CACHE_ENTRIES);

function rgbFromAnsi(ansi: string): string | undefined {
  const match = ansi.match(/38;2;(\d+);(\d+);(\d+)/u);
  if (!match) return undefined;
  return `#${match.slice(1).map((part) =>
    Number(part).toString(16).padStart(2, "0")
  ).join("")}`;
}

function cachedImage(
  latex: string,
  color: string,
  availableWidth: number
): TypesetImage | undefined {
  if (latex.length > MAX_LATEX_LENGTH) return undefined;
  const cell = getCellDimensions();
  const key = JSON.stringify([latex, color, availableWidth, cell.widthPx, cell.heightPx]);
  return imageCache.getOrCreate(
    key,
    () => typesetMath(latex, color, availableWidth, cell),
    (image) => image.scale >= 0.5
  );
}

function restoredSessionMode(entries: readonly unknown[]): FormulaPathMode {
  for (let index = entries.length - 1; index >= 0; index -= 1) {
    const entry = entries[index] as {
      type?: unknown;
      customType?: unknown;
      data?: { path?: unknown };
    };
    if (entry.type !== "custom" || entry.customType !== PATH_ENTRY) continue;
    const path = entry.data?.path;
    if (path === "auto" || path === "image" || path === "text") return path;
  }
  return "auto";
}

function terminalName(env: NodeJS.ProcessEnv): string {
  const program = env.TERM_PROGRAM?.toLowerCase() ?? "";
  const term = env.TERM?.toLowerCase() ?? "";
  if (env.TMUX || term.startsWith("tmux")) return "tmux";
  if (term.startsWith("screen")) return "screen";
  if (program.includes("ghostty") || env.GHOSTTY_RESOURCES_DIR) return "Ghostty";
  if (program.includes("kitty") || term.includes("kitty")) return "Kitty";
  return "unknown";
}

export default function registerFormula(pi: ExtensionAPI): void {
  const sharedApi = pi as ExtensionAPI & { [key: symbol]: boolean | undefined };
  if (sharedApi[REGISTRATION_KEY]) return;
  sharedApi[REGISTRATION_KEY] = true;
  let path: "image" | "text" = "text";
  let selectionReason = "session has not started";
  let probe: TerminalProbe = {
    path: "text", reason: "session has not started", response: "not started"
  };
  let sessionMode: FormulaPathMode = "auto";
  let defaultPath: "image" | "text" | undefined;
  let configPath = formulaConfigPath(process.env);
  let terminal = "unknown";
  let hasTerminalScreen = false;
  let imagePathForbidden = true;
  let macroCount = 0;
  let textColor: (() => string | undefined) = () => undefined;

  const selectPath = (): void => {
    if (imagePathForbidden) {
      path = "text";
      selectionReason = probe.reason;
    } else if (sessionMode !== "auto") {
      path = sessionMode;
      selectionReason = "manual session setting";
    } else if (defaultPath) {
      path = defaultPath;
      selectionReason = "default setting";
    } else {
      path = probe.path;
      selectionReason = probe.reason;
    }
  };

  pi.on("session_start", async (_event, ctx) => {
    textColor = () => rgbFromAnsi(ctx.ui.theme.getFgAnsi("text"));
    configPath = formulaConfigPath(process.env);
    defaultPath = readDefaultPath(configPath);
    macroCount = countConfiguredMacros(configPath, process.env);
    sessionMode = restoredSessionMode(ctx.sessionManager.getBranch());
    terminal = terminalName(process.env);
    hasTerminalScreen = ctx.mode === "tui";

    const multiplexer = multiplexerProbeResult(process.env);
    imagePathForbidden = !hasTerminalScreen || multiplexer !== undefined;
    if (multiplexer) {
      probe = multiplexer;
    } else if (hasTerminalScreen) {
      let pending: Promise<TerminalProbe> | undefined;
      ctx.ui.setWidget("pi-formula-probe", (tui) => {
        pending = probePngSupport(tui);
        return { render: () => [], invalidate: () => {} };
      });
      probe = pending
        ? await pending
        : { path: "text", reason: "terminal UI unavailable", response: "not queried" };
      ctx.ui.setWidget("pi-formula-probe", undefined);
    } else {
      probe = {
        path: "text", reason: `${ctx.mode} mode has no terminal screen`, response: "not queried"
      };
    }
    selectPath();
  });

  pi.registerMarkdownTransformer((markdown, context) => {
    if (context.messageType === "assistant-thinking" || path === "text") return markdown;
    const color = textColor();
    if (!color) return markdown;
    const transfers = new Map<number, string>();
    const transformed = transformDisplayMath(markdown, (latex, original) => {
      const image = cachedImage(latex, color, context.availableWidth);
      if (!image) return original;
      try {
        const identity = JSON.stringify([
          latex, color, context.availableWidth, image.columns, image.rows
        ]);
        const id = stableImageId(identity);
        transfers.set(id, encodeTransfer(image.png, id, image.columns, image.rows));
        return encodePlaceholderRows(id, image.columns, image.rows).join("\n");
      } catch {
        return original;
      }
    });
    return transfers.size === 0
      ? transformed
      : `${Array.from(transfers.values()).join("")}\n${transformed}`;
  });

  pi.registerCommand("formula", {
    description: "Show status, select auto/image/text, or clear the image cache",
    handler: async (args, ctx) => {
      const tokens = args.trim().split(/\s+/u).filter(Boolean);
      const action = tokens[0] ?? "status";
      const saveDefault = tokens.length === 2 && tokens[1] === "--default";

      if (action === "clear" && tokens.length === 1) {
        imageCache.clear();
        ctx.ui.notify("pi-formula cache cleared", "info");
        return;
      }

      if ((action === "auto" || action === "image" || action === "text")
          && (tokens.length === 1 || saveDefault)) {
        if (saveDefault) {
          try {
            writeDefaultPath(configPath, action);
            defaultPath = readDefaultPath(configPath);
          } catch {
            ctx.ui.notify(
              "Could not save the pi-formula default; the session path was not changed.",
              "error"
            );
            return;
          }
        }
        sessionMode = action;
        pi.appendEntry(PATH_ENTRY, { path: action });
        selectPath();
        ctx.ui.notify(`pi-formula path: ${path} (${selectionReason})`, "info");
        return;
      }

      if (action !== "status" || tokens.length !== 1) {
        ctx.ui.notify(
          "Usage: /formula status|clear|auto|image|text [--default]",
          "warning"
        );
        return;
      }

      const stats = imageCache.stats();
      ctx.ui.setWidget("pi-formula-status", [
        `pi-formula ${manifest.version}`,
        `path: ${path}`,
        `reason: ${selectionReason}`,
        `terminal: ${terminal}`,
        `macros: ${macroCount}`,
        `cache: ${stats.entries} entries, ${stats.bytes} bytes`,
        `last failure: ${stats.lastFailure ?? "none"}`
      ], { placement: "belowEditor" });
    }
  });
}
