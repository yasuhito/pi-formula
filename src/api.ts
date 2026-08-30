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
const SHARED_KEY = Symbol.for("pi-formula.shared-api.v1");

export interface FormulaPng {
  data: Buffer;
  widthPx: number;
  heightPx: number;
  columns: number;
  rows: number;
}

interface FormulaState {
  registered: boolean;
  path: "image" | "text";
  probe: TerminalProbe;
  textColor?: string;
  userMacros: FormulaMacros;
  additionalMacros: Record<string, MacroDefinition>;
  imageCache: Map<string, TypesetImage | null>;
}

interface SharedStore {
  states: WeakMap<object, FormulaState>;
}

function sharedStore(): SharedStore {
  const existing = Reflect.get(globalThis, SHARED_KEY) as SharedStore | undefined;
  if (existing) return existing;
  const created: SharedStore = { states: new WeakMap() };
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
  if (state.path === "text" || !state.textColor || latex.length > MAX_LATEX_LENGTH) {
    return undefined;
  }
  const cell = getCellDimensions();
  const macros = effectiveMacros(state);
  const key = JSON.stringify([
    latex,
    state.textColor,
    availableWidth,
    cell.widthPx,
    cell.heightPx,
    macros
  ]);
  const cached = state.imageCache.get(key);
  if (cached !== undefined) return cached ?? undefined;
  try {
    const image = typesetMath(latex, state.textColor, availableWidth, cell, macros);
    state.imageCache.set(key, image.scale >= 0.5 ? image : null);
  } catch {
    state.imageCache.set(key, null);
  }
  while (state.imageCache.size > MAX_CACHE_ENTRIES) {
    const oldest = state.imageCache.keys().next().value as string | undefined;
    if (oldest === undefined) break;
    state.imageCache.delete(oldest);
  }
  return state.imageCache.get(key) ?? undefined;
}

/** Create one display-formula PNG using the registered extension's current path and theme. */
export function createFormulaPng(
  pi: ExtensionAPI,
  latex: string,
  availableWidth: number
): FormulaPng | undefined {
  const state = sharedStore().states.get(pi as object);
  if (!state || !Number.isFinite(availableWidth) || availableWidth <= 0) return undefined;
  const image = cachedImage(state, latex, availableWidth);
  if (!image) return undefined;
  return {
    data: image.png,
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
  let state = store.states.get(pi as object);
  if (!state) {
    state = {
      registered: false,
      path: "text",
      probe: {
        path: "text", reason: "session has not started", response: "not started"
      },
      userMacros: loadUserMacros(process.env).macros,
      additionalMacros: {},
      imageCache: new Map()
    };
    store.states.set(pi as object, state);
  }

  const additions = validateAdditionalMacros(additionalMacros);
  for (const [name, definition] of Object.entries(additions)) {
    if (!(name in state.additionalMacros)) state.additionalMacros[name] = definition;
  }
  if (Object.keys(additions).length > 0) state.imageCache.clear();
  if (state.registered) return;
  state.registered = true;

  pi.on("session_start", async (_event, ctx) => {
    state!.textColor = rgbFromAnsi(ctx.ui.theme.getFgAnsi("text"));
    const multiplexer = multiplexerProbeResult(process.env);
    if (multiplexer) {
      state!.probe = multiplexer;
    } else if (ctx.mode === "tui") {
      let pending: Promise<TerminalProbe> | undefined;
      ctx.ui.setWidget("pi-formula-probe", (tui) => {
        pending = probePngSupport(tui);
        return { render: () => [], invalidate: () => {} };
      });
      state!.probe = pending
        ? await pending
        : { path: "text", reason: "terminal UI unavailable", response: "not queried" };
      ctx.ui.setWidget("pi-formula-probe", undefined);
    } else {
      state!.probe = {
        path: "text", reason: `${ctx.mode} mode has no terminal image path`, response: "not queried"
      };
    }
    state!.path = state!.probe.path;
  });

  pi.registerMarkdownTransformer((markdown, context) => {
    if (context.messageType === "assistant-thinking" || state!.path === "text") return markdown;
    const transfers = new Map<number, string>();
    const transformed = transformDisplayMath(markdown, (latex, original) => {
      const image = cachedImage(state!, latex, context.availableWidth);
      if (!image) return original;
      try {
        const identity = JSON.stringify([
          latex,
          state!.textColor,
          context.availableWidth,
          image.columns,
          image.rows,
          effectiveMacros(state!)
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
    description: "Show the pi-formula version and current rendering path",
    handler: async (args, ctx) => {
      if (args.trim() && args.trim() !== "status") {
        ctx.ui.notify("Usage: /formula status", "warning");
        return;
      }
      ctx.ui.setWidget("pi-formula-status", [
        `pi-formula ${manifest.version}`,
        `path: ${state!.path}`,
        `reason: ${state!.probe.reason}`,
        `probe: ${state!.probe.response}`
      ], { placement: "belowEditor" });
    }
  });
}
