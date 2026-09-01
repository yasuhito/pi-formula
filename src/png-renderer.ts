import { createHash } from "node:crypto";
import { readFileSync, statSync } from "node:fs";
import { encodePlaceholderRows, encodeTransfer, stableImageId } from "./kitty";
import type { CellDimensions } from "./layout";
import { FORMULA_SAFETY_LIMITS } from "./typesetter";

const PNG_SIGNATURE = Buffer.from("89504e470d0a1a0a", "hex");
const IHDR_TYPE = "IHDR";

export type PngSource = Buffer | string;

export type PngRenderResult =
  | {
      rendered: true;
      output: string;
      widthPx: number;
      heightPx: number;
      columns: number;
      rows: number;
    }
  | {
      rendered: false;
      reason: "image-unavailable" | "invalid-png" | "safety-limit";
    };

interface PngDimensions {
  width: number;
  height: number;
}

type PngLoadResult =
  | { png: Buffer }
  | { reason: "invalid-png" | "safety-limit" };

function readPng(source: PngSource): PngLoadResult {
  try {
    if (Buffer.isBuffer(source)) {
      return source.length <= FORMULA_SAFETY_LIMITS.cacheBytes
        ? { png: source }
        : { reason: "safety-limit" };
    }
    if (typeof source !== "string" || source.length === 0) {
      return { reason: "invalid-png" };
    }
    if (statSync(source).size > FORMULA_SAFETY_LIMITS.cacheBytes) {
      return { reason: "safety-limit" };
    }
    const png = readFileSync(source);
    return png.length <= FORMULA_SAFETY_LIMITS.cacheBytes
      ? { png }
      : { reason: "safety-limit" };
  } catch {
    return { reason: "invalid-png" };
  }
}

function pngDimensions(png: Buffer): PngDimensions | undefined {
  if (
    png.length < 33 ||
    !png.subarray(0, PNG_SIGNATURE.length).equals(PNG_SIGNATURE) ||
    png.readUInt32BE(8) !== 13 ||
    png.subarray(12, 16).toString("ascii") !== IHDR_TYPE
  ) {
    return undefined;
  }
  const width = png.readUInt32BE(16);
  const height = png.readUInt32BE(20);
  return width > 0 && height > 0 ? { width, height } : undefined;
}

function validCellDimensions(cell: CellDimensions): boolean {
  return (
    Number.isFinite(cell.widthPx) &&
    cell.widthPx > 0 &&
    Number.isFinite(cell.heightPx) &&
    cell.heightPx > 0
  );
}

export function renderPngForTerminal(
  source: PngSource,
  availableWidth: number,
  cell: CellDimensions,
): PngRenderResult {
  if (
    !Number.isFinite(availableWidth) ||
    availableWidth <= 0 ||
    !validCellDimensions(cell)
  ) {
    return { rendered: false, reason: "invalid-png" };
  }
  const loaded = readPng(source);
  if (!("png" in loaded)) return { rendered: false, reason: loaded.reason };
  const { png } = loaded;
  const dimensions = pngDimensions(png);
  if (!dimensions) return { rendered: false, reason: "invalid-png" };

  const availableColumns = Math.max(1, Math.floor(availableWidth));
  const naturalColumns = Math.max(
    1,
    Math.ceil(dimensions.width / cell.widthPx),
  );
  const columns = Math.min(availableColumns, naturalColumns);
  const scale = (columns * cell.widthPx) / dimensions.width;
  const widthPx = columns * cell.widthPx;
  const heightPx = dimensions.height * scale;
  const rows = Math.max(1, Math.ceil(heightPx / cell.heightPx));
  if (
    columns > FORMULA_SAFETY_LIMITS.imageColumns ||
    rows > FORMULA_SAFETY_LIMITS.imageRows
  ) {
    return { rendered: false, reason: "safety-limit" };
  }

  const key = createHash("sha256")
    .update(png)
    .update(`:${columns}:${rows}`)
    .digest("hex");
  const id = stableImageId(key);
  const transfer = encodeTransfer(png, id, columns, rows);
  const placeholder = encodePlaceholderRows(id, columns, rows).join("\n");
  return {
    rendered: true,
    output: `${transfer}\x1b[0m\n\n${placeholder}`,
    widthPx,
    heightPx,
    columns,
    rows,
  };
}
