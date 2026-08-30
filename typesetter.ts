import { Resvg } from "@resvg/resvg-js";
import { liteAdaptor } from "@mathjax/src/js/adaptors/liteAdaptor.js";
import { RegisterHTMLHandler } from "@mathjax/src/js/handlers/html.js";
import { TeX } from "@mathjax/src/js/input/tex.js";
import "@mathjax/src/js/input/tex/ams/AmsConfiguration.js";
import "@mathjax/src/js/input/tex/base/BaseConfiguration.js";
import "@mathjax/src/js/input/tex/configmacros/ConfigMacrosConfiguration.js";
import "@mathjax/src/js/input/tex/newcommand/NewcommandConfiguration.js";
import { mathjax } from "@mathjax/src/js/mathjax.js";
import { SVG } from "@mathjax/src/js/output/svg.js";

import type { CachedImage } from "./cache";
import type { CellDimensions, RasterLayout } from "./layout";
import type { MathMacros } from "./macros";

const DISPLAY_EX_TO_CELL_HEIGHT = 0.65;
const INLINE_EX_TO_CELL_HEIGHT = 0.65;
const CONTENT_BLEED_PX = 1;
const DEVICE_SCALE = 2;

const adaptor = liteAdaptor({ fontSize: 16 });
RegisterHTMLHandler(adaptor);

export interface TypesetImage extends RasterLayout, CachedImage {}

function mathDocument(macros: MathMacros) {
  const configured = Object.fromEntries(Object.entries(macros).map(([name, definition]) => [
    name,
    typeof definition === "string" ? definition : [definition[0], definition[1]]
  ]));
  const tex = new TeX({
    packages: ["base", "ams", "newcommand", "configmacros"],
    macros: {
      ...configured,
      ket: ["\\left|#1\\right\\rangle", 1],
      bra: ["\\left\\langle#1\\right|", 1],
      braket: ["\\left\\langle#1\\middle|#2\\right\\rangle", 2]
    },
    formatError: (_jax: unknown, error: unknown) => {
      throw error;
    }
  });
  const svgOutput = new SVG({
    fontCache: "local",
    linebreaks: { inline: false }
  });
  return mathjax.document("", { InputJax: tex, OutputJax: svgOutput });
}

function svgFor(
  latex: string,
  display: boolean,
  color: string,
  widthPx: number,
  macros: MathMacros
): string {
  const node = mathDocument(macros).convert(latex, {
    display,
    em: 16,
    ex: 8,
    containerWidth: widthPx
  });
  const container = adaptor.outerHTML(node);
  const start = container.indexOf("<svg ");
  const end = container.lastIndexOf("</svg>");
  if (start < 0 || end < 0) throw new Error("MathJax did not produce an SVG");
  return container
    .slice(start, end + "</svg>".length)
    .replace("<svg ", `<svg color="${color}" `);
}

function exDimension(svg: string, name: "width" | "height"): number {
  const match = new RegExp(`\\b${name}="([\\d.]+)ex"`).exec(svg);
  const value = match ? Number.parseFloat(match[1]!) : Number.NaN;
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
  canvasHeight: number
): string {
  const openingEnd = source.indexOf(">");
  if (openingEnd < 0) throw new Error("MathJax SVG has no opening element");
  const attributes = source.slice(0, openingEnd + 1)
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
    "</svg>"
  ].join("");
}

function rasterLayout(
  svg: string,
  display: boolean,
  color: string,
  availableWidth: number,
  cell: CellDimensions
): { layout: RasterLayout; padded: string } {
  const maxWidthCells = Math.max(1, Math.min(Math.floor(availableWidth), 255));
  const widthEx = exDimension(svg, "width");
  const heightEx = exDimension(svg, "height");
  const innerWidth = maxWidthCells * cell.widthPx - CONTENT_BLEED_PX * 2;
  const innerHeight = cell.heightPx - CONTENT_BLEED_PX * 2;
  const basePixelsPerEx = cell.heightPx * (
    display ? DISPLAY_EX_TO_CELL_HEIGHT : INLINE_EX_TO_CELL_HEIGHT
  );
  const pixelsPerEx = Math.min(
    basePixelsPerEx,
    innerWidth / widthEx,
    display ? Number.POSITIVE_INFINITY : innerHeight / heightEx
  );
  const widthPx = Math.max(1, widthEx * pixelsPerEx);
  const heightPx = Math.max(1, heightEx * pixelsPerEx);
  const columns = Math.max(1, Math.ceil(
    (widthPx + CONTENT_BLEED_PX * 2) / cell.widthPx - 1e-9
  ));
  const rows = display
    ? Math.max(1, Math.ceil((heightPx + CONTENT_BLEED_PX * 2) / cell.heightPx - 1e-9))
    : 1;
  const canvasWidth = Math.ceil(columns * cell.widthPx * DEVICE_SCALE);
  const canvasHeight = Math.ceil(rows * cell.heightPx * DEVICE_SCALE);
  const layout = {
    widthPx: Math.round(widthPx),
    heightPx: Math.round(heightPx),
    columns,
    rows,
    scale: pixelsPerEx / basePixelsPerEx
  };
  return {
    layout,
    padded: paddedSvg(
      svg,
      color,
      widthPx * DEVICE_SCALE,
      heightPx * DEVICE_SCALE,
      canvasWidth,
      canvasHeight
    )
  };
}

export function typesetMath(
  latex: string,
  display: boolean,
  color: string,
  availableWidth: number,
  cell: CellDimensions,
  macros: MathMacros = {}
): TypesetImage {
  const svg = svgFor(latex, display, color, availableWidth * cell.widthPx, macros);
  const { layout, padded } = rasterLayout(svg, display, color, availableWidth, cell);
  const png = new Resvg(padded, {
    shapeRendering: 2,
    textRendering: 2
  }).render().asPng();

  return { ...layout, svg, png };
}
