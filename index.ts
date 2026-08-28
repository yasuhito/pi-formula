import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent" with { "resolution-mode": "import" };

import { RenderCache } from "./cache";
import { encodePlaceholderRows, encodeTransfer, stableImageId } from "./kitty";
import { transformMathMarkdown } from "./markdown";
import { typesetMath, type TypesetImage } from "./typesetter";

const packageManifest = JSON.parse(
  readFileSync(resolve(__dirname, "../../package.json"), "utf8")
) as { version?: unknown };

if (typeof packageManifest.version !== "string") {
  throw new Error("qni-math could not read the qni-cli package version");
}

const { getCellDimensions } = require("@earendil-works/pi-tui") as {
  getCellDimensions: () => { widthPx: number; heightPx: number };
};

const STATUS_HEADER = `qni-math ${packageManifest.version}\npath: image (fixed)`;
const imageCache = new RenderCache<TypesetImage>(128, 32 * 1024 * 1024);

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
  availableWidth: number
): TypesetImage | undefined {
  const cell = getCellDimensions();
  const key = JSON.stringify([latex, display, color, availableWidth, cell.widthPx, cell.heightPx]);
  return imageCache.getOrCreate(
    key,
    () => typesetMath(latex, display, color, availableWidth, cell)
  );
}

function initialTextColor(): string {
  const background = process.env.COLORFGBG?.split(";").at(-1);
  const index = background === undefined ? undefined : Number.parseInt(background, 10);
  return index !== undefined && index >= 7 ? "#1f2328" : "#d4d4d4";
}

export default function qniMathExtension(pi: ExtensionAPI): void {
  let textColor = initialTextColor();

  pi.on("session_start", (_event, ctx) => {
    textColor = rgbFromAnsi(ctx.ui.theme.getFgAnsi("text")) ?? textColor;
  });

  pi.registerMarkdownTransformer((markdown, context) => {
    if (context.messageType === "assistant-thinking") return markdown;

    const transfers = new Map<number, string>();
    const transformed = transformMathMarkdown(markdown, (latex, display, original) => {
      const image = cachedImage(latex, display, textColor, context.availableWidth);
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

  pi.registerCommand("math", {
    description: "Show qni-math status or clear its cache",
    handler: async (args, ctx) => {
      const action = args.trim();
      if (action === "clear") {
        imageCache.clear();
        ctx.ui.notify("qni-math cache cleared", "info");
        return;
      }
      if (action !== "status") {
        ctx.ui.notify("Usage: /math status|clear", "warning");
        return;
      }

      const stats = imageCache.stats();
      const failure = stats.lastFailure?.replace(/\s+/g, " ") ?? "none";
      ctx.ui.setWidget("qni-math-status", [
        ...STATUS_HEADER.split("\n"),
        `cache: ${stats.entries} entries, ${stats.bytes} bytes`,
        `last failure: ${failure}`
      ], {
        placement: "belowEditor"
      });
    }
  });
}
