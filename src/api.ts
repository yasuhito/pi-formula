import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent" with {
  "resolution-mode": "import",
};

import {
  type FormulaPathMode,
  formulaConfigPath,
  loadFormulaConfig,
  saveDefaultPath,
} from "./config";
import {
  FormulaImageRenderer,
  type FormulaPng,
  type PngRenderResult,
} from "./formula-image-renderer";
import {
  type FormulaMacros,
  type MacroDefinition,
  validateAdditionalMacros,
} from "./macros";
import { transformDisplayMath } from "./markdown";
import type { PngSource } from "./png-source";
import { formulaSerifStatus } from "./system-font";
import {
  multiplexerProbeResult,
  probePngSupport,
  type TerminalProbe,
} from "./terminal-probe";

const manifest = JSON.parse(
  readFileSync(resolve(__dirname, "../package.json"), "utf8"),
) as { version?: unknown };
if (typeof manifest.version !== "string") {
  throw new Error("pi-formula could not read its package version");
}

const PATH_ENTRY = "pi-formula-path";
const SHARED_KEY = Symbol.for("pi-formula.shared-api.v1");

export type FormulaPath = "image" | "text";
export type {
  FormulaPng,
  PngRenderResult,
} from "./formula-image-renderer";
export type { PngSource } from "./png-source";

interface FormulaState {
  path: "image" | "text";
  selectionReason: string;
  probe: TerminalProbe;
  sessionPreference: FormulaPathMode | undefined;
  defaultPath?: "image" | "text";
  configPath: string;
  terminal: string;
  hasTerminalScreen: boolean;
  imagePathForbidden: boolean;
  textColor: () => string | undefined;
  userMacros: FormulaMacros;
  additionalMacros: Record<string, MacroDefinition>;
  imageRenderer: FormulaImageRenderer;
}

interface SharedStore {
  current?: FormulaState;
}

function sharedStore(): SharedStore {
  const existing = Reflect.get(globalThis, SHARED_KEY) as
    | SharedStore
    | undefined;
  if (existing) return existing;
  const created: SharedStore = {};
  Reflect.set(globalThis, SHARED_KEY, created);
  return created;
}

function rgbFromAnsi(ansi: string): string | undefined {
  const match = ansi.match(
    /(?:^|[;[])38;2;(\d{1,3});(\d{1,3});(\d{1,3})(?=m|;)/u,
  );
  if (!match) return undefined;
  const channels = match.slice(1).map(Number);
  if (channels.some((channel) => !Number.isInteger(channel) || channel > 255)) {
    return undefined;
  }
  return `#${channels.map((channel) => channel.toString(16).padStart(2, "0")).join("")}`;
}

function effectiveMacros(state: FormulaState): FormulaMacros {
  return { ...state.userMacros, ...state.additionalMacros };
}

function restoredSessionPreference(
  entries: readonly unknown[],
): FormulaPathMode | undefined {
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
  return undefined;
}

function terminalName(env: NodeJS.ProcessEnv): string {
  const program = env.TERM_PROGRAM?.toLowerCase() ?? "";
  const term = env.TERM?.toLowerCase() ?? "";
  if (env.TMUX || term.startsWith("tmux")) return "tmux";
  if (term.startsWith("screen")) return "screen";
  if (program.includes("ghostty") || env.GHOSTTY_RESOURCES_DIR)
    return "Ghostty";
  if (program.includes("kitty") || term.includes("kitty")) return "Kitty";
  return "unknown";
}

function selectPath(state: FormulaState): void {
  if (state.imagePathForbidden) {
    state.path = "text";
    state.selectionReason = state.probe.reason;
  } else if (
    state.sessionPreference === "image" ||
    state.sessionPreference === "text"
  ) {
    state.path = state.sessionPreference;
    state.selectionReason = "manual session setting";
  } else if (state.sessionPreference === undefined && state.defaultPath) {
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
    probe: {
      path: "text",
      reason: "session has not started",
      response: "not started",
    },
    sessionPreference: undefined,
    configPath: formulaConfigPath(process.env),
    terminal: "unknown",
    hasTerminalScreen: false,
    imagePathForbidden: true,
    textColor: () => undefined,
    userMacros: {},
    additionalMacros: Object.create(null) as Record<string, MacroDefinition>,
    imageRenderer: new FormulaImageRenderer(),
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
  if (changed) state.imageRenderer.clear();
}

/** Return the registered extension's current display path. */
export function getFormulaPath(): FormulaPath {
  return sharedStore().current?.path ?? "text";
}

/** Render an existing PNG for the current image path. */
export function renderPng(
  source: PngSource,
  availableWidth: number,
): PngRenderResult {
  if (getFormulaPath() !== "image") {
    return { rendered: false, reason: "image-unavailable" };
  }
  const state = sharedStore().current;
  if (!state) return { rendered: false, reason: "image-unavailable" };
  return state.imageRenderer.renderPng(source, availableWidth);
}

/** Create one display-formula PNG using the registered extension's current path and theme. */
export function createFormulaPng(
  latex: string,
  availableWidth: number,
): FormulaPng | undefined {
  const state = sharedStore().current;
  if (
    typeof latex !== "string" ||
    !state ||
    !Number.isFinite(availableWidth) ||
    availableWidth <= 0
  )
    return undefined;
  if (state.path === "text") return undefined;
  return state.imageRenderer.createPng(latex, {
    availableWidth,
    color: state.textColor(),
    macros: effectiveMacros(state),
  });
}

/** Register Formula for Pi and merge protected additional macros from another extension. */
export function registerFormula(
  pi: ExtensionAPI,
  additionalMacros: FormulaMacros = {},
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
    state.imageRenderer.clear();
    store.current = undefined;
  });

  pi.on("session_start", async (_event, ctx) => {
    state.textColor = () => rgbFromAnsi(ctx.ui.theme.getFgAnsi("text"));
    const config = loadFormulaConfig(process.env);
    state.configPath = config.filePath;
    state.defaultPath = config.defaultPath;
    state.userMacros = config.macros;
    state.imageRenderer.clear();
    state.sessionPreference = restoredSessionPreference(
      ctx.sessionManager.getBranch(),
    );
    state.terminal = terminalName(process.env);
    state.hasTerminalScreen = ctx.mode === "tui";

    const multiplexer = multiplexerProbeResult(process.env);
    state.imagePathForbidden =
      !state.hasTerminalScreen || multiplexer !== undefined;
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
        : {
            path: "text",
            reason: "terminal UI unavailable",
            response: "not queried",
          };
      ctx.ui.setWidget("pi-formula-probe", undefined);
    } else {
      state.probe = {
        path: "text",
        reason: `${ctx.mode} mode has no terminal screen`,
        response: "not queried",
      };
    }
    selectPath(state);
  });

  pi.registerMarkdownTransformer((markdown, context) => {
    if (
      context.isStreaming ||
      context.messageType === "assistant-thinking" ||
      state.path === "text"
    )
      return markdown;
    const renderFormula = state.imageRenderer.createMarkdownRenderer({
      availableWidth: context.availableWidth,
      color: state.textColor(),
      macros: effectiveMacros(state),
    });
    return transformDisplayMath(markdown, renderFormula);
  });

  pi.registerCommand("formula", {
    description:
      "Show status, select auto/image/text, or clear the image cache",
    handler: async (args, ctx) => {
      const tokens = args.trim().split(/\s+/u).filter(Boolean);
      const action = tokens[0] ?? "status";
      const saveDefault = tokens.length === 2 && tokens[1] === "--default";

      if (action === "clear" && tokens.length === 1) {
        state.imageRenderer.clear();
        ctx.ui.notify("pi-formula cache cleared", "info");
        return;
      }

      if (
        (action === "auto" || action === "image" || action === "text") &&
        (tokens.length === 1 || saveDefault)
      ) {
        if (saveDefault) {
          try {
            state.defaultPath = saveDefaultPath(state.configPath, action);
          } catch {
            ctx.ui.notify(
              "Could not save the pi-formula default; the session path was not changed.",
              "error",
            );
            return;
          }
        }
        state.sessionPreference = action;
        pi.appendEntry(PATH_ENTRY, { path: action });
        selectPath(state);
        ctx.ui.notify(
          `pi-formula path: ${state.path} (${state.selectionReason})`,
          "info",
        );
        return;
      }

      if (action !== "status" || tokens.length !== 1) {
        ctx.ui.notify(
          "Usage: /formula status|clear|auto|image|text [--default]",
          "warning",
        );
        return;
      }

      const stats = state.imageRenderer.stats();
      ctx.ui.setWidget(
        "pi-formula-status",
        [
          `pi-formula ${manifest.version}`,
          `path: ${state.path}`,
          `reason: ${state.selectionReason}`,
          `terminal: ${state.terminal}`,
          `serif: ${formulaSerifStatus()}`,
          `macros: ${Object.keys(effectiveMacros(state)).length}`,
          `cache: ${stats.entries} entries, ${stats.bytes} bytes`,
          `last failure: ${stats.lastFailure ?? "none"}`,
        ],
        { placement: "belowEditor" },
      );
    },
  });
}
