import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent" with { "resolution-mode": "import" };

const { getCellDimensions } = require("@earendil-works/pi-tui") as {
  getCellDimensions(): { widthPx: number; heightPx: number };
};

import { encodePlaceholderRows, encodeTransfer, stableImageId } from "./kitty";
import {
  loadUserMacros,
  validateAdditionalMacros,
  type FormulaMacros,
  type MacroDefinition
} from "./macros";
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
const SHARED_KEY = Symbol.for("pi-formula.shared-api.v1");

export interface FormulaPng {
  data: Buffer;
  widthPx: number;
  heightPx: number;
  columns: number;
  rows: number;
}

interface FormulaState {
  path: "image" | "text";
  selectionReason: string;
  probe: TerminalProbe;
  sessionMode: FormulaPathMode;
  defaultPath?: "image" | "text";
  configPath: string;
  terminal: string;
  hasTerminalScreen: boolean;
  imagePathForbidden: boolean;
  textColor: () => string | undefined;
  userMacros: FormulaMacros;
  additionalMacros: Record<string, MacroDefinition>;
  imageCache: RenderCache;
}

interface SharedStore {
  current?: FormulaState;
}

function sharedStore(): SharedStore {
  const existing = Reflect.get(globalThis, SHARED_KEY) as SharedStore | undefined;
  if (existing) return existing;
  const created: SharedStore = {};
  Reflect.set(globalThis, SHARED_KEY, created);
  return created;
}

function rgbFromAnsi(ansi: string): string | undefined {
  const match = ansi.match(/38;2;(\d+);(\d+);(\d+)/u);
  if (!match) return undefined;
  return `#${match.slice(1).map((part) =>
    Number(part).toString(16).padStart(2, "0")
  ).join("")}`;
}

function effectiveMacros(state: FormulaState): FormulaMacros {
  return { ...state.userMacros, ...state.additionalMacros };
}

function cachedImage(
  state: FormulaState,
  latex: string,
  availableWidth: number
): TypesetImage | undefined {
  if (state.path === "text" || latex.length > MAX_LATEX_LENGTH) return undefined;
  const color = state.textColor();
  if (!color) return undefined;
  const cell = getCellDimensions();
  const macros = effectiveMacros(state);
  const key = JSON.stringify([
    latex, color, availableWidth, cell.widthPx, cell.heightPx, macros
  ]);
  return state.imageCache.getOrCreate(
    key,
    () => typesetMath(latex, color, availableWidth, cell, macros),
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

function selectPath(state: FormulaState): void {
  if (state.imagePathForbidden) {
    state.path = "text";
    state.selectionReason = state.probe.reason;
  } else if (state.sessionMode !== "auto") {
    state.path = state.sessionMode;
    state.selectionReason = "manual session setting";
  } else if (state.defaultPath) {
    state.path = state.defaultPath;
    state.selectionReason = "default setting";
  } else {
    state.path = state.probe.path;
    state.selectionReason = state.probe.reason;
  }
}

function newState(): FormulaState {
  return {
    path: "text",
    selectionReason: "session has not started",
    probe: { path: "text", reason: "session has not started", response: "not started" },
    sessionMode: "auto",
    configPath: formulaConfigPath(process.env),
    terminal: "unknown",
    hasTerminalScreen: false,
    imagePathForbidden: true,
    textColor: () => undefined,
    userMacros: {},
    additionalMacros: Object.create(null) as Record<string, MacroDefinition>,
    imageCache: new RenderCache(MAX_CACHE_ENTRIES)
  };
}

function addProtectedMacros(state: FormulaState, macros: FormulaMacros): void {
  const additions = validateAdditionalMacros(macros);
  let changed = false;
  for (const [name, definition] of Object.entries(additions)) {
    if (Object.hasOwn(state.additionalMacros, name)) continue;
    state.additionalMacros[name] = definition;
    changed = true;
  }
  if (changed) state.imageCache.clear();
}

/** Create one display-formula PNG using the registered extension's current path and theme. */
export function createFormulaPng(
  latex: string,
  availableWidth: number
): FormulaPng | undefined {
  const state = sharedStore().current;
  if (typeof latex !== "string"
      || !state
      || !Number.isFinite(availableWidth)
      || availableWidth <= 0) return undefined;
  const image = cachedImage(state, latex, availableWidth);
  if (!image) return undefined;
  return {
    data: Buffer.from(image.png),
    widthPx: image.widthPx,
    heightPx: image.heightPx,
    columns: image.columns,
    rows: image.rows
  };
}

/** Register Formula for Pi and merge protected additional macros from another extension. */
export function registerFormula(
  pi: ExtensionAPI,
  additionalMacros: FormulaMacros = {}
): void {
  const store = sharedStore();
  const current = store.current;
  if (current) {
    addProtectedMacros(current, additionalMacros);
    return;
  }

  const state = newState();
  addProtectedMacros(state, additionalMacros);
  store.current = state;

  pi.on("session_shutdown", () => {
    if (store.current !== state) return;
    state.imageCache.clear();
    store.current = undefined;
  });

  pi.on("session_start", async (_event, ctx) => {
    state.textColor = () => rgbFromAnsi(ctx.ui.theme.getFgAnsi("text"));
    state.configPath = formulaConfigPath(process.env);
    state.defaultPath = readDefaultPath(state.configPath);
    state.userMacros = loadUserMacros(process.env).macros;
    state.imageCache.clear();
    state.sessionMode = restoredSessionMode(ctx.sessionManager.getBranch());
    state.terminal = terminalName(process.env);
    state.hasTerminalScreen = ctx.mode === "tui";

    const multiplexer = multiplexerProbeResult(process.env);
    state.imagePathForbidden = !state.hasTerminalScreen || multiplexer !== undefined;
    if (multiplexer) {
      state.probe = multiplexer;
    } else if (state.hasTerminalScreen) {
      let pending: Promise<TerminalProbe> | undefined;
      ctx.ui.setWidget("pi-formula-probe", (tui) => {
        pending = probePngSupport(tui);
        return { render: () => [], invalidate: () => {} };
      });
      state.probe = pending
        ? await pending
        : { path: "text", reason: "terminal UI unavailable", response: "not queried" };
      ctx.ui.setWidget("pi-formula-probe", undefined);
    } else {
      state.probe = {
        path: "text", reason: `${ctx.mode} mode has no terminal screen`, response: "not queried"
      };
    }
    selectPath(state);
  });

  pi.registerMarkdownTransformer((markdown, context) => {
    if (context.messageType === "assistant-thinking" || state.path === "text") return markdown;
    const color = state.textColor();
    if (!color) return markdown;
    const transfers = new Map<number, string>();
    const transformed = transformDisplayMath(markdown, (latex, original) => {
      const image = cachedImage(state, latex, context.availableWidth);
      if (!image) return original;
      try {
        const identity = JSON.stringify([
          latex, color, context.availableWidth, image.columns, image.rows, effectiveMacros(state)
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
        state.imageCache.clear();
        ctx.ui.notify("pi-formula cache cleared", "info");
        return;
      }

      if ((action === "auto" || action === "image" || action === "text")
          && (tokens.length === 1 || saveDefault)) {
        if (saveDefault) {
          try {
            writeDefaultPath(state.configPath, action);
            state.defaultPath = readDefaultPath(state.configPath);
          } catch {
            ctx.ui.notify(
              "Could not save the pi-formula default; the session path was not changed.",
              "error"
            );
            return;
          }
        }
        state.sessionMode = action;
        pi.appendEntry(PATH_ENTRY, { path: action });
        selectPath(state);
        ctx.ui.notify(`pi-formula path: ${state.path} (${state.selectionReason})`, "info");
        return;
      }

      if (action !== "status" || tokens.length !== 1) {
        ctx.ui.notify(
          "Usage: /formula status|clear|auto|image|text [--default]",
          "warning"
        );
        return;
      }

      const stats = state.imageCache.stats();
      ctx.ui.setWidget("pi-formula-status", [
        `pi-formula ${manifest.version}`,
        `path: ${state.path}`,
        `reason: ${state.selectionReason}`,
        `terminal: ${state.terminal}`,
        `macros: ${Object.keys(effectiveMacros(state)).length}`,
        `cache: ${stats.entries} entries, ${stats.bytes} bytes`,
        `last failure: ${stats.lastFailure ?? "none"}`
      ], { placement: "belowEditor" });
    }
  });
}
