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
import { calculateRasterLayout, type CellDimensions, type RasterLayout } from "./layout";

const adaptor = liteAdaptor({ fontSize: 16 });
RegisterHTMLHandler(adaptor);

const tex = new TeX({
  packages: ["base", "ams", "newcommand", "configmacros"],
  macros: {
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
const document = mathjax.document("", { InputJax: tex, OutputJax: svgOutput });

export interface TypesetImage extends RasterLayout, CachedImage {}

function svgFor(latex: string, display: boolean, color: string, widthPx: number): string {
  const node = document.convert(latex, {
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

export function typesetMath(
  latex: string,
  display: boolean,
  color: string,
  availableWidth: number,
  cell: CellDimensions
): TypesetImage {
  const svg = svgFor(latex, display, color, availableWidth * cell.widthPx);
  const natural = new Resvg(svg).render();
  const layout = calculateRasterLayout(
    natural.width,
    natural.height,
    display,
    availableWidth,
    cell
  );
  const rendered = layout.scale === 1
    ? natural
    : new Resvg(svg, { fitTo: { mode: "zoom", value: layout.scale } }).render();

  return { ...layout, svg, png: rendered.asPng() };
}
