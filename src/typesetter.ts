import type { CellDimensions, RasterLayout } from "./layout";
import type { FormulaMacros } from "./macros";
import { formulaSerifFamily } from "./system-font";

const EX_TO_CELL_HEIGHT = 0.65;
const CONTENT_BLEED_PX = 1;
const DEVICE_SCALE = 2;

export const FORMULA_SAFETY_LIMITS = Object.freeze({
  latexCharacters: 16_384,
  imageColumns: 255,
  imageRows: 255,
  pngBytes: 32 * 1024 * 1024,
  pngPixels: 2048 * 2048,
  cacheEntries: 64,
  cacheBytes: 32 * 1024 * 1024,
});

export interface TypesetImage extends RasterLayout {
  svg: string;
  png: Buffer;
}

interface MathAdaptor {
  outerHTML(node: unknown): string;
}

interface MathDocument {
  convert(
    latex: string,
    options: {
      display: boolean;
      em: number;
      ex: number;
      containerWidth: number;
    },
  ): unknown;
}

interface SvgOutput {
  font: {
    loadDynamicFilesSync(): void;
  };
}

interface PreparedTypesetter {
  adaptor: MathAdaptor;
  createDocument(macros: FormulaMacros): MathDocument;
  rasterize(svg: string): Buffer;
}

let prepared: PreparedTypesetter | undefined;

function configuredMacros(
  macros: FormulaMacros,
): Record<string, string | [string, number]> {
  return Object.fromEntries(
    Object.entries(macros).map(([name, definition]) => [
      name,
      typeof definition === "string"
        ? definition
        : [definition[0], definition[1]],
    ]),
  );
}

function prepareTypesetter(): PreparedTypesetter {
  if (prepared) return prepared;

  const { Resvg } = require("@resvg/resvg-js") as {
    Resvg: new (
      svg: string,
      options: {
        shapeRendering: number;
        textRendering: number;
        font: {
          loadSystemFonts: boolean;
          defaultFontFamily?: string;
          serifFamily?: string;
        };
      },
    ) => { render(): { asPng(): Uint8Array } };
  };
  const { liteAdaptor } =
    require("@mathjax/src/js/adaptors/liteAdaptor.js") as {
      liteAdaptor(options: { fontSize: number }): MathAdaptor;
    };
  const { RegisterHTMLHandler } =
    require("@mathjax/src/js/handlers/html.js") as {
      RegisterHTMLHandler(adaptor: MathAdaptor): void;
    };
  const { TeX } = require("@mathjax/src/js/input/tex.js") as {
    TeX: new (options: Record<string, unknown>) => unknown;
  };
  require("@mathjax/src/js/input/tex/ams/AmsConfiguration.js");
  require("@mathjax/src/js/input/tex/base/BaseConfiguration.js");
  require("@mathjax/src/js/input/tex/configmacros/ConfigMacrosConfiguration.js");
  require("@mathjax/src/js/input/tex/newcommand/NewcommandConfiguration.js");
  const { mathjax } = require("@mathjax/src/js/mathjax.js") as {
    mathjax: {
      document(source: string, options: Record<string, unknown>): MathDocument;
    };
  };
  require("@mathjax/src/js/util/asyncLoad/node.js");
  const { SVG } = require("@mathjax/src/js/output/svg.js") as {
    SVG: new (options: Record<string, unknown>) => SvgOutput;
  };

  const adaptor = liteAdaptor({ fontSize: 16 });
  RegisterHTMLHandler(adaptor);
  const svgOutput = new SVG({
    fontCache: "local",
    linebreaks: { inline: false },
  });
  svgOutput.font.loadDynamicFilesSync();
  const serifFamily = formulaSerifFamily();
  const font = serifFamily
    ? {
        loadSystemFonts: true,
        defaultFontFamily: serifFamily,
        serifFamily,
      }
    : { loadSystemFonts: true };
  prepared = {
    adaptor,
    createDocument: (macros) => {
      const tex = new TeX({
        packages: ["base", "ams", "newcommand", "configmacros"],
        macros: configuredMacros(macros),
        formatError: (_jax: unknown, error: unknown) => {
          throw error;
        },
      });
      return mathjax.document("", { InputJax: tex, OutputJax: svgOutput });
    },
    rasterize: (svg) =>
      Buffer.from(
        new Resvg(svg, {
          shapeRendering: 2,
          textRendering: 2,
          font,
        })
          .render()
          .asPng(),
      ),
  };
  return prepared;
}

function svgFor(
  latex: string,
  color: string,
  widthPx: number,
  macros: FormulaMacros,
  typesetter: PreparedTypesetter,
): string {
  const node = typesetter.createDocument(macros).convert(latex, {
    display: true,
    em: 16,
    ex: 8,
    containerWidth: widthPx,
  });
  const container = typesetter.adaptor.outerHTML(node);
  const start = container.indexOf("<svg ");
  const end = container.lastIndexOf("</svg>");
  if (start < 0 || end < 0) throw new Error("MathJax did not produce an SVG");
  return container
    .slice(start, end + "</svg>".length)
    .replace("<svg ", `<svg color="${color}" `);
}

function exDimension(svg: string, name: "width" | "height"): number {
  const match =
    name === "width"
      ? /\bwidth="([\d.]+)ex"/u.exec(svg)
      : /\bheight="([\d.]+)ex"/u.exec(svg);
  const value = Number.parseFloat(match?.[1] ?? "");
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`MathJax SVG has no positive ${name}`);
  }
  return value;
}

function paddedSvg(
  source: string,
  color: string,
  contentWidth: number,
  contentHeight: number,
  canvasWidth: number,
  canvasHeight: number,
): string {
  const openingEnd = source.indexOf(">");
  if (openingEnd < 0) throw new Error("MathJax SVG has no opening element");
  const attributes = source
    .slice(0, openingEnd + 1)
    .replace(/^<svg\s*/u, "")
    .replace(/\s(?:width|height|x|y|color|style|overflow)="[^"]*"/gu, "")
    .replace(/>$/u, "")
    .trim();
  const body = source.slice(openingEnd + 1, -"</svg>".length);
  const x = Math.max(0, (canvasWidth - contentWidth) / 2);
  const y = Math.max(0, (canvasHeight - contentHeight) / 2);
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${canvasWidth}" height="${canvasHeight}" `,
    `viewBox="0 0 ${canvasWidth} ${canvasHeight}" color="${color}">`,
    `<svg x="${x}" y="${y}" width="${contentWidth}" height="${contentHeight}" `,
    `overflow="visible" ${attributes}>`,
    body,
    "</svg>",
    "</svg>",
  ].join("");
}

function rasterLayout(
  svg: string,
  color: string,
  availableWidth: number,
  cell: CellDimensions,
): { layout: RasterLayout; padded: string } {
  const maxWidthCells = Math.max(
    1,
    Math.min(Math.floor(availableWidth), FORMULA_SAFETY_LIMITS.imageColumns),
  );
  const widthEx = exDimension(svg, "width");
  const heightEx = exDimension(svg, "height");
  const innerWidth = maxWidthCells * cell.widthPx - CONTENT_BLEED_PX * 2;
  const basePixelsPerEx = cell.heightPx * EX_TO_CELL_HEIGHT;
  const pixelsPerEx = Math.min(basePixelsPerEx, innerWidth / widthEx);
  const widthPx = Math.max(1, widthEx * pixelsPerEx);
  const heightPx = Math.max(1, heightEx * pixelsPerEx);
  const columns = Math.max(
    1,
    Math.ceil((widthPx + CONTENT_BLEED_PX * 2) / cell.widthPx - 1e-9),
  );
  const rows = Math.max(
    1,
    Math.ceil((heightPx + CONTENT_BLEED_PX * 2) / cell.heightPx - 1e-9),
  );
  if (columns > FORMULA_SAFETY_LIMITS.imageColumns) {
    throw new Error("Formula image exceeds the fixed column limit");
  }
  if (rows > FORMULA_SAFETY_LIMITS.imageRows) {
    throw new Error("Formula image exceeds the fixed row limit");
  }
  const canvasWidth = Math.ceil(columns * cell.widthPx * DEVICE_SCALE);
  const canvasHeight = Math.ceil(rows * cell.heightPx * DEVICE_SCALE);
  const layout = {
    widthPx: Math.round(widthPx),
    heightPx: Math.round(heightPx),
    columns,
    rows,
    scale: pixelsPerEx / basePixelsPerEx,
  };
  return {
    layout,
    padded: paddedSvg(
      svg,
      color,
      widthPx * DEVICE_SCALE,
      heightPx * DEVICE_SCALE,
      canvasWidth,
      canvasHeight,
    ),
  };
}

function validCellDimensions(cell: CellDimensions): boolean {
  return (
    Number.isFinite(cell.widthPx) &&
    cell.widthPx > 0 &&
    Number.isFinite(cell.heightPx) &&
    cell.heightPx > 0
  );
}

export function typesetMath(
  latex: string,
  color: string,
  availableWidth: number,
  cell: CellDimensions,
  macros: FormulaMacros = {},
): TypesetImage {
  if (latex.length > FORMULA_SAFETY_LIMITS.latexCharacters) {
    throw new Error("Formula input exceeds the fixed character limit");
  }
  if (!/^#[\da-f]{6}$/iu.test(color)) {
    throw new Error("Formula color is not an exact RGB value");
  }
  if (
    !Number.isFinite(availableWidth) ||
    availableWidth <= 0 ||
    !validCellDimensions(cell)
  ) {
    throw new Error("Formula layout dimensions must be finite and positive");
  }

  const typesetter = prepareTypesetter();
  const svg = svgFor(
    latex,
    color,
    availableWidth * cell.widthPx,
    macros,
    typesetter,
  );
  const { layout, padded } = rasterLayout(svg, color, availableWidth, cell);
  const png = typesetter.rasterize(padded);
  return { ...layout, svg, png };
}
