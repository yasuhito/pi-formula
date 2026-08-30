import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent" with { "resolution-mode": "import" };

const { getCellDimensions } = require("@earendil-works/pi-tui") as {
  getCellDimensions(): { widthPx: number; heightPx: number };
};

import { encodePlaceholderRows, encodeTransfer, stableImageId } from "./kitty";
import { transformDisplayMath } from "./markdown";
import { multiplexerProbeResult, probePngSupport, type TerminalProbe } from "./terminal-probe";
import { FORMULA_SAFETY_LIMITS, typesetMath, type TypesetImage } from "./typesetter";

const manifest = JSON.parse(
  readFileSync(resolve(__dirname, "../package.json"), "utf8")
) as { version?: unknown };
if (typeof manifest.version !== "string") {
  throw new Error("pi-formula could not read its package version");
}

const REGISTRATION_KEY = Symbol.for("pi-formula.registered");

interface FormulaRendering {
  id: number;
  image: TypesetImage;
  placeholder: string;
  transfer: string;
}

interface CacheEntry {
  bytes: number;
  rendering: FormulaRendering | null;
}

const imageCache = new Map<string, CacheEntry>();
let imageCacheBytes = 0;

function rgbFromAnsi(ansi: string): string | undefined {
  const match = ansi.match(/(?:^|[;[])38;2;(\d{1,3});(\d{1,3});(\d{1,3})(?=m|;)/u);
  if (!match) return undefined;
  const channels = match.slice(1).map(Number);
  if (channels.some((channel) => !Number.isInteger(channel) || channel > 255)) {
    return undefined;
  }
  return `#${channels.map((channel) =>
    channel.toString(16).padStart(2, "0")
  ).join("")}`;
}

function cacheKey(
  latex: string,
  color: string,
  availableWidth: number,
  cell: { widthPx: number; heightPx: number }
): string {
  return createHash("sha256").update(JSON.stringify([
    latex, color, availableWidth, cell.widthPx, cell.heightPx
  ])).digest("hex");
}

function renderingBytes(key: string, rendering: FormulaRendering | null): number {
  if (!rendering) return Buffer.byteLength(key);
  return Buffer.byteLength(key) + rendering.image.png.byteLength +
    Buffer.byteLength(rendering.image.svg) + Buffer.byteLength(rendering.transfer) +
    Buffer.byteLength(rendering.placeholder);
}

function storeRendering(key: string, rendering: FormulaRendering | null): FormulaRendering | undefined {
  let stored = rendering;
  let bytes = renderingBytes(key, stored);
  if (bytes > FORMULA_SAFETY_LIMITS.cacheBytes) {
    stored = null;
    bytes = renderingBytes(key, null);
  }
  imageCache.set(key, { bytes, rendering: stored });
  imageCacheBytes += bytes;
  while (imageCache.size > FORMULA_SAFETY_LIMITS.cacheEntries ||
         imageCacheBytes > FORMULA_SAFETY_LIMITS.cacheBytes) {
    const oldest = imageCache.keys().next().value as string | undefined;
    if (oldest === undefined) break;
    const evicted = imageCache.get(oldest);
    imageCache.delete(oldest);
    imageCacheBytes -= evicted?.bytes ?? 0;
  }
  return stored ?? undefined;
}

function cachedRendering(
  latex: string,
  color: string,
  availableWidth: number
): FormulaRendering | undefined {
  const cell = getCellDimensions();
  const key = cacheKey(latex, color, availableWidth, cell);
  const cached = imageCache.get(key);
  if (cached) {
    imageCache.delete(key);
    imageCache.set(key, cached);
    return cached.rendering ?? undefined;
  }
  try {
    const image = typesetMath(latex, color, availableWidth, cell);
    if (image.scale < 0.5) return storeRendering(key, null);
    const id = stableImageId(key);
    return storeRendering(key, {
      id,
      image,
      transfer: encodeTransfer(image.png, id, image.columns, image.rows),
      placeholder: encodePlaceholderRows(id, image.columns, image.rows).join("\n")
    });
  } catch {
    return storeRendering(key, null);
  }
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
      const rendering = cachedRendering(latex, color, context.availableWidth);
      if (!rendering) return original;
      transfers.set(rendering.id, rendering.transfer);
      return rendering.placeholder;
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
