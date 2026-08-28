import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent" with { "resolution-mode": "import" };

import { RenderCache } from "./cache";
import { encodePlaceholderRows, encodeTransfer, stableImageId } from "./kitty";
import { loadMathMacros, type MathMacros } from "./macros";
import { expandQuantumMacros, transformMathMarkdown } from "./markdown";
import {
  mathConfigPath,
  readDefaultPath,
  writeDefaultPath,
  type MathPathMode
} from "./path-settings";
import { multiplexerProbeResult, probePngSupport, type TerminalProbe } from "./terminal-probe";
import { typesetMath, type TypesetImage } from "./typesetter";

const packageManifest = JSON.parse(
  readFileSync(resolve(__dirname, "../../package.json"), "utf8")
) as { version?: unknown };

if (typeof packageManifest.version !== "string") {
  throw new Error("qni-math could not read the qni-cli package version");
}

const { Type } = require("typebox");
const {
  getCapabilities,
  getCellDimensions,
  Image,
  setCapabilities,
  Text
} = require("@earendil-works/pi-tui") as {
  getCapabilities: () => { images: "kitty" | "iterm2" | null; trueColor: boolean; hyperlinks: boolean };
  getCellDimensions: () => { widthPx: number; heightPx: number };
  Image: new (
    base64Data: string,
    mimeType: string,
    theme: { fallbackColor: (text: string) => string },
    options?: { maxWidthCells?: number; maxHeightCells?: number }
  ) => { render(width: number): string[]; invalidate(): void };
  setCapabilities: (capabilities: {
    images: "kitty" | "iterm2" | null;
    trueColor: boolean;
    hyperlinks: boolean;
  }) => void;
  Text: new (text: string, paddingX?: number, paddingY?: number) => {
    render(width: number): string[];
    invalidate(): void;
  };
};

const imageCache = new RenderCache<TypesetImage>(128, 32 * 1024 * 1024);
const qniExecutable = resolve(__dirname, "../bin/qni.js");

function rgbFromAnsi(ansi: string): string | undefined {
  const trueColor = ansi.match(/38;2;(\d+);(\d+);(\d+)/);
  if (trueColor) {
    return `#${trueColor.slice(1).map((part) => Number(part).toString(16).padStart(2, "0")).join("")}`;
  }
  const indexed = ansi.match(/38;5;(\d+)/);
  if (!indexed) return undefined;
  const value = Number(indexed[1]);
  if (value >= 232) {
    const gray = 8 + (value - 232) * 10;
    return `#${gray.toString(16).padStart(2, "0").repeat(3)}`;
  }
  if (value >= 16) {
    const offset = value - 16;
    const component = (index: number): number => {
      const level = Math.floor(offset / (6 ** index)) % 6;
      return level === 0 ? 0 : 55 + level * 40;
    };
    return `#${[component(2), component(1), component(0)]
      .map((part) => part.toString(16).padStart(2, "0")).join("")}`;
  }
  return undefined;
}

function cachedImage(
  latex: string,
  display: boolean,
  color: string,
  availableWidth: number,
  macros: MathMacros
): TypesetImage | undefined {
  const cell = getCellDimensions();
  const key = JSON.stringify([
    latex,
    display,
    color,
    availableWidth,
    cell.widthPx,
    cell.heightPx,
    macros
  ]);
  return imageCache.getOrCreate(
    key,
    () => typesetMath(latex, display, color, availableWidth, cell, macros)
  );
}

function initialTextColor(): string {
  const background = process.env.COLORFGBG?.split(";").at(-1);
  const index = background === undefined ? undefined : Number.parseInt(background, 10);
  return index !== undefined && index >= 7 ? "#1f2328" : "#d4d4d4";
}

function restoredSessionMode(entries: readonly unknown[]): MathPathMode {
  for (let index = entries.length - 1; index >= 0; index -= 1) {
    const entry = entries[index] as {
      type?: unknown;
      customType?: unknown;
      data?: { path?: unknown };
    };
    if (entry.type !== "custom" || entry.customType !== "qni-math-path") continue;
    const path = entry.data?.path;
    if (path === "auto" || path === "image" || path === "text") return path;
  }
  return "auto";
}

function applyCapabilities(path: "image" | "text"): void {
  setCapabilities({
    ...getCapabilities(),
    images: path === "image" ? "kitty" : null
  });
}

export default function qniMathExtension(pi: ExtensionAPI): void {
  let effectivePath: "image" | "text" = "text";
  let selectionReason = "起動前";
  let probe: TerminalProbe = {
    path: "text",
    reason: "問い合わせ前",
    response: "not-started"
  };
  let sessionMode: MathPathMode = "auto";
  let defaultPath: "image" | "text" | undefined;
  let configPath = mathConfigPath(process.env);
  let textColor = initialTextColor();
  let userMacros: MathMacros = {};
  let macroError: string | undefined;

  const selectPath = (): void => {
    if (sessionMode !== "auto") {
      effectivePath = sessionMode;
      selectionReason = "手動指定";
    } else if (defaultPath) {
      effectivePath = defaultPath;
      selectionReason = "全体既定";
    } else {
      effectivePath = probe.path;
      selectionReason = probe.reason;
    }
    applyCapabilities(effectivePath);
  };

  pi.on("session_start", async (_event, ctx) => {
    textColor = rgbFromAnsi(ctx.ui.theme.getFgAnsi("text")) ?? textColor;
    configPath = mathConfigPath(process.env);
    defaultPath = readDefaultPath(configPath);
    const loadedMacros = loadMathMacros(configPath, process.env);
    userMacros = loadedMacros.macros;
    macroError = loadedMacros.error;
    sessionMode = restoredSessionMode(ctx.sessionManager.getBranch());

    const multiplexer = multiplexerProbeResult(process.env);
    if (multiplexer) {
      probe = multiplexer;
    } else if (ctx.mode === "tui") {
      let pending: Promise<TerminalProbe> | undefined;
      ctx.ui.setWidget("qni-math-probe", (tui) => {
        pending = probePngSupport(tui);
        return { render: () => [], invalidate: () => {} };
      });
      probe = pending
        ? await pending
        : { path: "text", reason: "端末 UI なし", response: "unavailable" };
      ctx.ui.setWidget("qni-math-probe", undefined);
    } else {
      probe = { path: "text", reason: `実行モード ${ctx.mode}`, response: "問い合わせなし" };
    }
    selectPath();
  });

  pi.registerMarkdownTransformer((markdown, context) => {
    if (context.messageType === "assistant-thinking") return markdown;
    if (effectivePath === "text") {
      return transformMathMarkdown(markdown, (_latex, _display, original) =>
        expandQuantumMacros(original, userMacros)
      );
    }

    const transfers = new Map<number, string>();
    const transformed = transformMathMarkdown(markdown, (latex, display, original) => {
      const image = cachedImage(latex, display, textColor, context.availableWidth, userMacros);
      if (!image) return original;
      const identity = JSON.stringify([
        latex,
        display,
        textColor,
        context.availableWidth,
        image.rows
      ]);
      const placementFailureKey = `placement:${identity}`;
      if (imageCache.hasFailure(placementFailureKey)) return original;

      try {
        const id = stableImageId(identity);
        const rows = encodePlaceholderRows(id, image.columns, image.rows);
        transfers.set(id, encodeTransfer(image.png, id, image.columns, image.rows));
        return display ? rows.join("\n") : rows[0]!;
      } catch (error) {
        imageCache.recordFailure(placementFailureKey, error);
        return original;
      }
    });

    return transfers.size === 0
      ? transformed
      : `${Array.from(transfers.values()).join("")}\n${transformed}`;
  });

  pi.registerTool({
    name: "qni",
    label: "Qni",
    description: "qni-cli をシェルを介さず実行する。引数に [\"--help\"] を渡すと使い方を確認できる。",
    parameters: Type.Object({
      args: Type.Array(Type.String())
    }),
    async execute(_toolCallId, params, signal, _onUpdate, ctx) {
      const { args } = params as { args: string[] };
      const result = await pi.exec(process.execPath, [qniExecutable, ...args], {
        cwd: ctx.cwd,
        signal
      });
      if (result.code !== 0) {
        const stderr = result.stderr.trimEnd();
        throw new Error(`${stderr ? `${stderr}\n` : ""}qni exited with status ${result.code}`);
      }
      return {
        content: [{ type: "text", text: result.stdout }],
        details: args.includes("--latex") ? { latex: result.stdout } : {}
      };
    },
    renderResult(result, { expanded }, theme) {
      const text = result.content.find((item) => item.type === "text")?.text ?? "";
      const details = result.details as { latex?: unknown } | undefined;
      if (effectivePath === "image" && typeof details?.latex === "string") {
        const latex = details.latex.trim();
        const color = rgbFromAnsi(theme.fg("toolOutput", "sample")) ?? textColor;
        const maxWidthCells = expanded ? 120 : 60;
        const image = cachedImage(latex, true, color, maxWidthCells, userMacros);
        if (image) {
          return new Image(
            image.png.toString("base64"),
            "image/png",
            { fallbackColor: (fallback) => theme.fg("muted", fallback) },
            { maxWidthCells, maxHeightCells: 4 }
          );
        }
      }
      return new Text(text.trimEnd(), 0, 0);
    }
  });

  pi.registerCommand("math", {
    description: "Show status, select auto/image/text, or clear the qni-math cache",
    handler: async (args, ctx) => {
      const tokens = args.trim().split(/\s+/u).filter(Boolean);
      const action = tokens[0] ?? "status";
      const saveDefault = tokens[1] === "--default" && tokens.length === 2;

      if (action === "clear" && tokens.length === 1) {
        imageCache.clear();
        ctx.ui.notify("qni-math cache cleared", "info");
        return;
      }

      if ((action === "auto" || action === "image" || action === "text")
          && (tokens.length === 1 || saveDefault)) {
        sessionMode = action;
        pi.appendEntry("qni-math-path", { path: action });
        if (saveDefault) {
          writeDefaultPath(configPath, action);
          defaultPath = readDefaultPath(configPath);
        }
        selectPath();
        ctx.ui.notify(`qni-math path: ${effectivePath} (${selectionReason})`, "info");
        return;
      }

      if (action !== "status" || tokens.length !== 1) {
        ctx.ui.notify("Usage: /math status|clear|auto|image|text [--default]", "warning");
        return;
      }

      const stats = imageCache.stats();
      const failure = stats.lastFailure?.replace(/\s+/g, " ") ?? "none";
      ctx.ui.setWidget("qni-math-status", [
        `qni-math ${packageManifest.version}`,
        `path: ${effectivePath}`,
        `reason: ${selectionReason}`,
        `probe: ${probe.response}`,
        `cache: ${stats.entries} entries, ${stats.bytes} bytes`,
        `macro error: ${macroError ?? "none"}`,
        `last failure: ${failure}`
      ], {
        placement: "belowEditor"
      });
    }
  });
}
