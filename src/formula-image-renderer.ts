import { createHash } from "node:crypto";

const { getCellDimensions } = require("@earendil-works/pi-tui") as {
  getCellDimensions(): { widthPx: number; heightPx: number };
};

import { encodePlaceholderRows, encodeTransfer, stableImageId } from "./kitty";
import type { FormulaMacros } from "./macros";
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

  createMarkdownRenderer(
    options: FormulaImageOptions,
  ): (latex: string, original: string) => string {
    const transferredIds = new Set<number>();
    return (latex, original) => {
      const cached = this.cachedImage(latex, options);
      if (!cached) return original;
      try {
        const id = this.dependencies.stableImageId(cached.key);
        const placeholder = this.dependencies
          .encodePlaceholderRows(id, cached.image.columns, cached.image.rows)
          .join("\n");
        if (transferredIds.has(id)) return placeholder;
        const transfer = this.dependencies.encodeTransfer(
          cached.image.png,
          id,
          cached.image.columns,
          cached.image.rows,
        );
        transferredIds.add(id);
        // Keep the final Kitty terminator away from Markdown's line-ending
        // backslash handling, and isolate the transfer as its own rendered line.
        return `${transfer}\x1b[0m\n\n${placeholder}`;
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
