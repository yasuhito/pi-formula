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
import {
  formatBatchFailure,
  formatCommandOutput,
  formatQniExitError,
  truncateQniOutput,
  validateQniToolParams,
  type QniExecResult,
  type QniToolDetails,
  type QniToolParams
} from "./qni-tool";
import { QniWorkdirs } from "./workdir";

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
  Container,
  Image,
  setCapabilities,
  Text
} = require("@earendil-works/pi-tui") as {
  Container: new () => {
    addChild(component: { render(width: number): string[]; invalidate(): void }): void;
    render(width: number): string[];
    invalidate(): void;
  };
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
  color: string,
  availableWidth: number,
  macros: MathMacros
): TypesetImage | undefined {
  const cell = getCellDimensions();
  const key = JSON.stringify([
    latex,
    color,
    availableWidth,
    cell.widthPx,
    cell.heightPx,
    macros
  ]);
  return imageCache.getOrCreate(
    key,
    () => typesetMath(latex, color, availableWidth, cell, macros)
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
  let currentTextColor = (): string => textColor;
  let userMacros: MathMacros = {};
  let macroError: string | undefined;
  const qniWorkdirs = new QniWorkdirs((customType, data) => pi.appendEntry(customType, data));

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

  pi.on("session_start", async (event, ctx) => {
    qniWorkdirs.restore(ctx.sessionManager.getBranch(), event.reason);
    currentTextColor = () => rgbFromAnsi(ctx.ui.theme.getFgAnsi("text")) ?? textColor;
    textColor = currentTextColor();
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

  pi.on("session_shutdown", (event) => {
    if (event.reason !== "reload") qniWorkdirs.cleanup();
  });

  pi.registerMarkdownTransformer((markdown, context) => {
    if (context.messageType === "assistant-thinking") return markdown;
    if (effectivePath === "text") {
      return transformMathMarkdown(markdown, (_latex, _display, original) =>
        expandQuantumMacros(original, userMacros)
      );
    }

    const transfers = new Map<number, string>();
    const color = currentTextColor();
    const transformed = transformMathMarkdown(markdown, (latex, display, original) => {
      if (!display) return expandQuantumMacros(original, userMacros);
      const image = cachedImage(latex, color, context.availableWidth, userMacros);
      if (!image) return original;
      const identity = JSON.stringify([
        latex,
        color,
        context.availableWidth,
        image.rows
      ]);
      const placementFailureKey = `placement:${identity}`;
      if (imageCache.hasFailure(placementFailureKey)) return original;

      try {
        const id = stableImageId(identity);
        const rows = encodePlaceholderRows(id, image.columns, image.rows);
        transfers.set(id, encodeTransfer(image.png, id, image.columns, image.rows));
        return rows.join("\n");
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
    description: "qni-cli をシェルを介さず実行する。依存するコマンド列は commands にまとめる。最初の失敗で止まり、成功分の変更は残るため、修正後は残りだけを呼び直す。workdir を省略するとセッション専用の一時作業場所を使う。利用者が選んだ場所には Pi の作業場所からの相対パスを指定する。引数に [\"--help\"] を渡すと使い方を確認できる。",
    parameters: Type.Object({
      args: Type.Optional(Type.Array(Type.String())),
      commands: Type.Optional(Type.Array(Type.Array(Type.String()))),
      workdir: Type.Optional(Type.String())
    }),
    async execute(_toolCallId, rawParams, signal, _onUpdate, ctx) {
      const params = rawParams as QniToolParams;
      validateQniToolParams(params);
      const workdir = qniWorkdirs.resolve(ctx.cwd, params.workdir);
      return qniWorkdirs.run(workdir, async () => {
        const executeCommand = async (args: string[]): Promise<QniExecResult> =>
          pi.exec(process.execPath, [qniExecutable, ...args], {
            cwd: workdir,
            signal
          });

        if (params.args) {
          const result = await executeCommand(params.args);
          if (result.killed) throw new Error("qni was cancelled");
          if (result.code !== 0) throw new Error(formatQniExitError(result));
          const output = await truncateQniOutput(result.stdout);
          return {
            content: [{ type: "text" as const, text: output.text }],
            details: {
              ...(params.args.includes("--latex") && !output.truncated
                ? { latex: result.stdout }
                : {}),
              workdir
            }
          };
        }

        const content: Array<{ type: "text"; text: string }> = [];
        const commandDetails: Array<{ args: string[]; latex?: string }> = [];
        for (const [index, args] of params.commands!.entries()) {
          const result = await executeCommand(args);
          if (result.killed) throw new Error("qni was cancelled");
          if (result.code !== 0) {
            throw new Error(formatBatchFailure(
              content.map((item) => item.text),
              args,
              result,
              index,
              params.commands!.length
            ));
          }
          const output = await formatCommandOutput(args, result.stdout);
          content.push({ type: "text", text: output.text });
          commandDetails.push({
            args,
            ...(args.includes("--latex") && !output.truncated
              ? { latex: result.stdout }
              : {})
          });
        }
        return { content, details: { workdir, commands: commandDetails } };
      });
    },
    renderResult(result, { expanded }, theme) {
      const details = result.details as QniToolDetails | undefined;
      const imageForLatex = (latex: string) => {
        if (effectivePath !== "image") return undefined;
        const color = rgbFromAnsi(theme.fg("toolOutput", "sample"));
        if (!color) return undefined;
        const maxWidthCells = expanded ? 120 : 60;
        const image = cachedImage(latex.trim(), color, maxWidthCells, userMacros);
        if (!image) return undefined;
        return new Image(
          image.png.toString("base64"),
          "image/png",
          { fallbackColor: (fallback) => theme.fg("muted", fallback) },
          { maxWidthCells, maxHeightCells: 4 }
        );
      };

      let body;
      if (details && "commands" in details) {
        const batch = new Container();
        const texts = result.content.filter((item) => item.type === "text");
        texts.forEach((item, index) => {
          const command = details.commands[index];
          const image = command?.latex ? imageForLatex(command.latex) : undefined;
          if (image) {
            batch.addChild(new Text(item.text.split("\n", 1)[0]!, 0, 0));
            batch.addChild(image);
          } else {
            batch.addChild(new Text(item.text.trimEnd(), 0, 0));
          }
        });
        body = batch;
      } else {
        const text = result.content.find((item) => item.type === "text")?.text ?? "";
        body = details?.latex ? imageForLatex(details.latex) : undefined;
        body ??= new Text(text.trimEnd(), 0, 0);
      }
      if (!expanded || !details) return body;

      const container = new Container();
      container.addChild(new Text(theme.fg("muted", `workdir: ${details.workdir}`), 0, 0));
      container.addChild(body);
      return container;
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
