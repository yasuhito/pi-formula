import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent" with { "resolution-mode": "import" };

const { getCellDimensions } = require("@earendil-works/pi-tui") as {
  getCellDimensions(): { widthPx: number; heightPx: number };
};

import { encodePlaceholderRows, encodeTransfer, stableImageId } from "./kitty";
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
const REGISTRATION_KEY = Symbol.for("pi-formula.registered");
const imageCache = new Map<string, TypesetImage | null>();

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
  const cached = imageCache.get(key);
  if (cached !== undefined) return cached ?? undefined;
  try {
    const image = typesetMath(latex, color, availableWidth, cell);
    imageCache.set(key, image.scale >= 0.5 ? image : null);
  } catch {
    imageCache.set(key, null);
  }
  while (imageCache.size > MAX_CACHE_ENTRIES) {
    const oldest = imageCache.keys().next().value as string | undefined;
    if (oldest === undefined) break;
    imageCache.delete(oldest);
  }
  return imageCache.get(key) ?? undefined;
}

export default function registerFormula(pi: ExtensionAPI): void {
  const sharedApi = pi as ExtensionAPI & { [key: symbol]: boolean | undefined };
  if (sharedApi[REGISTRATION_KEY]) return;
  sharedApi[REGISTRATION_KEY] = true;
  let path: "image" | "text" = "text";
  let probe: TerminalProbe = {
    path: "text", reason: "session has not started", response: "not started"
  };
  let textColor: (() => string | undefined) = () => undefined;

  pi.on("session_start", async (_event, ctx) => {
    textColor = () => rgbFromAnsi(ctx.ui.theme.getFgAnsi("text"));
    const multiplexer = multiplexerProbeResult(process.env);
    if (multiplexer) {
      probe = multiplexer;
    } else if (ctx.mode === "tui") {
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
        path: "text", reason: `${ctx.mode} mode has no terminal image path`, response: "not queried"
      };
    }
    path = probe.path;
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
    description: "Show the pi-formula version and current rendering path",
    handler: async (args, ctx) => {
      if (args.trim() && args.trim() !== "status") {
        ctx.ui.notify("Usage: /formula status", "warning");
        return;
      }
      ctx.ui.setWidget("pi-formula-status", [
        `pi-formula ${manifest.version}`,
        `path: ${path}`,
        `reason: ${probe.reason}`,
        `probe: ${probe.response}`
      ], { placement: "belowEditor" });
    }
  });
}
