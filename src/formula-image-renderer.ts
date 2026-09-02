import { createHash } from "node:crypto";

const { getCellDimensions } = require("@earendil-works/pi-tui") as {
  getCellDimensions(): { widthPx: number; heightPx: number };
};

import { encodePlaceholderRows, encodeTransfer, stableImageId } from "./kitty";
import type { FormulaMacros } from "./macros";
import { loadPng, type PngSource } from "./png-source";
import { RenderCache, type RenderCacheStats } from "./render-cache";
import {
  FORMULA_SAFETY_LIMITS,
  type TypesetImage,
  typesetMath,
} from "./typesetter";

export interface FormulaPng {
  data: Buffer;
  widthPx: number;
  heightPx: number;
  columns: number;
  rows: number;
}

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

export interface FormulaImageOptions {
  availableWidth: number;
  color: string | undefined;
  macros: FormulaMacros;
}

export interface FormulaImageRendererDependencies {
  getCellDimensions: typeof getCellDimensions;
  typesetMath: typeof typesetMath;
  stableImageId: typeof stableImageId;
  encodeTransfer: typeof encodeTransfer;
  encodePlaceholderRows: typeof encodePlaceholderRows;
}

interface CachedImage {
  image: TypesetImage;
  key: string;
}

const defaultDependencies: FormulaImageRendererDependencies = {
  getCellDimensions,
  typesetMath,
  stableImageId,
  encodeTransfer,
  encodePlaceholderRows,
};

/** Own the complete image path from typesetting through terminal placement. */
export class FormulaImageRenderer {
  private readonly cache = new RenderCache(
    FORMULA_SAFETY_LIMITS.cacheEntries,
    FORMULA_SAFETY_LIMITS.cacheBytes,
  );

  private readonly dependencies: FormulaImageRendererDependencies;

  constructor(dependencies: Partial<FormulaImageRendererDependencies> = {}) {
    this.dependencies = { ...defaultDependencies, ...dependencies };
  }

  createPng(
    latex: string,
    options: FormulaImageOptions,
  ): FormulaPng | undefined {
    const cached = this.cachedImage(latex, options);
    if (!cached) return undefined;
    return {
      data: Buffer.from(cached.image.png),
      widthPx: cached.image.widthPx,
      heightPx: cached.image.heightPx,
      columns: cached.image.columns,
      rows: cached.image.rows,
    };
  }

  renderPng(source: PngSource, availableWidth: number): PngRenderResult {
    if (!Number.isFinite(availableWidth) || availableWidth <= 0) {
      return { rendered: false, reason: "invalid-png" };
    }
    const loaded = loadPng(source);
    if (!loaded.loaded) return { rendered: false, reason: loaded.reason };
    try {
      const cell = this.dependencies.getCellDimensions();
      if (
        !Number.isFinite(cell.widthPx) ||
        cell.widthPx <= 0 ||
        !Number.isFinite(cell.heightPx) ||
        cell.heightPx <= 0
      ) {
        return { rendered: false, reason: "invalid-png" };
      }
      const maximumColumns = Math.max(
        1,
        Math.min(
          Math.floor(availableWidth),
          FORMULA_SAFETY_LIMITS.imageColumns,
        ),
      );
      const naturalColumns = Math.max(
        1,
        Math.ceil(loaded.width / cell.widthPx),
      );
      const columns = Math.min(maximumColumns, naturalColumns);
      const scale = (columns * cell.widthPx) / loaded.width;
      const widthPx = columns * cell.widthPx;
      const heightPx = loaded.height * scale;
      const rows = Math.max(1, Math.ceil(heightPx / cell.heightPx));
      if (rows > FORMULA_SAFETY_LIMITS.imageRows) {
        return { rendered: false, reason: "safety-limit" };
      }
      const key = createHash("sha256")
        .update(loaded.data)
        .update(`:${columns}:${rows}`)
        .digest("hex");
      return {
        rendered: true,
        output: this.placePng(
          loaded.data,
          this.dependencies.stableImageId(key),
          columns,
          rows,
        ),
        widthPx,
        heightPx,
        columns,
        rows,
      };
    } catch {
      return { rendered: false, reason: "invalid-png" };
    }
  }

  createMarkdownRenderer(
    options: FormulaImageOptions,
  ): (latex: string, original: string) => string {
    return (latex, original) => {
      const cached = this.cachedImage(latex, options);
      if (!cached) return original;
      try {
        const id = this.dependencies.stableImageId(cached.key);
        const placeholder = this.dependencies
          .encodePlaceholderRows(id, cached.image.columns, cached.image.rows)
          .join("\n");
        const placed = this.placePng(
          cached.image.png,
          id,
          cached.image.columns,
          cached.image.rows,
          placeholder,
        );
        return placed;
      } catch {
        this.cache.recordFailure(cached.key, "placement failed");
        return original;
      }
    };
  }

  clear(): void {
    this.cache.clear();
  }

  stats(): RenderCacheStats {
    return this.cache.stats();
  }

  private placePng(
    png: Buffer,
    id: number,
    columns: number,
    rows: number,
    existingPlaceholder?: string,
  ): string {
    const transfer = this.dependencies.encodeTransfer(png, id, columns, rows);
    const placeholder =
      existingPlaceholder ??
      this.dependencies.encodePlaceholderRows(id, columns, rows).join("\n");
    // Keep the final Kitty terminator away from Markdown's line-ending
    // backslash handling, and isolate the transfer as its own rendered line.
    return `${transfer}\x1b[0m\n\n${placeholder}`;
  }

  private cachedImage(
    latex: string,
    options: FormulaImageOptions,
  ): CachedImage | undefined {
    if (
      latex.length > FORMULA_SAFETY_LIMITS.latexCharacters ||
      !options.color
    ) {
      return undefined;
    }
    const cell = this.dependencies.getCellDimensions();
    const key = createHash("sha256")
      .update(
        JSON.stringify([
          latex,
          options.color,
          options.availableWidth,
          cell.widthPx,
          cell.heightPx,
          options.macros,
        ]),
      )
      .digest("hex");
    const image = this.cache.getOrCreate(
      key,
      () =>
        this.dependencies.typesetMath(
          latex,
          options.color as string,
          options.availableWidth,
          cell,
          options.macros,
        ),
      (value) => value.scale >= 0.5,
    );
    return image ? { image, key } : undefined;
  }
}
