import assert from "node:assert/strict";
import test from "node:test";
import { Markdown, renderLatex } from "@earendil-works/pi-tui";
import { identityMarkdownTheme } from "./support/markdown-theme.js";

const {
  transformDisplayMath,
}: typeof import("../dist/markdown.js") = require("../dist/markdown.js");

const THEME = identityMarkdownTheme;

function piSeesMath(markdown: string) {
  const render = (renderLatex: boolean) =>
    new Markdown(markdown, 0, 0, THEME, undefined, { renderLatex })
      .render(80)
      .join("\n");
  if (render(true) !== render(false)) return true;
  if (
    displayFormulasIn(markdown).some(
      (latex) => renderLatex(latex, { display: true }) === undefined,
    )
  )
    return undefined;
  return false;
}

function displayFormulasIn(markdown: string) {
  const rendered: string[] = [];
  transformDisplayMath(markdown, (latex) => {
    rendered.push(latex);
    return "<image>";
  });
  return rendered;
}

function formulasPiKeptAsText(markdown: string) {
  const consumed: Array<{ latex: string; original: string }> = [];
  transformDisplayMath(markdown, (latex, original) => {
    consumed.push({ latex, original });
    return "<image>";
  });
  const withMath = new Markdown(markdown, 0, 0, THEME, undefined, {
    renderLatex: true,
  })
    .render(120)
    .join("\n");
  return consumed
    .filter(({ original }) => withMath.includes(original.split("\n")[0]))
    .map(({ latex }) => latex);
}

const PLAIN_FOR_PI = [
  ["standalone monetary amounts", "$5 and $10"],
  [
    "monetary amounts, URLs, and escapes in prose",
    "It costs $5 or $10. https://example.com/$5 uses $HOME and \\$5.",
  ],
  ["shell variables and a bare dollar sign", "$HOME and $"],
  [
    "words starting with dollar signs",
    "The values are $first and $second, not a formula.",
  ],
  ["a monetary amount starting with two dollar signs", "価格は $$100 です。"],
  [
    "mixed monetary amounts and inline notation",
    "価格は $5、状態は |s⟩。\n$HOME の後は |t⟩。",
  ],
  [
    "introductory dollar signs and a monetary amount",
    "前置き $$ は数式ではありません。\n$$100 です。",
  ],
  ["a shell variable in a URL", "https://example.com/$HOME の後は |s⟩"],
  ["two dollar signs in a URL", "https://example.com/a$$b$$c"],
  ["display-math-like notation in code", "`$$inline$$`"],
  ["inline-math-like notation in code", "inline: `$\\ket{s}$`"],
  ["prose starting with two dollar signs", "$$通常本文\n"],
  ["whitespace immediately after a dollar sign", "$ x $"],
];

const PI_FORMULA_ONLY = [
  ["a nested list", "- 外側\n  - 式: $$\n    x^2\n    $$", "\nx^2\n"],
  ["a blockquote", "> 式: \\[\n> x^2\n> \\]", "\nx^2\n"],
];

const AGREES_WITH_PI = [
  ["a standalone display formula", "$$x = 1$$"],
  ["a numeric-only display formula", "$$100$$"],
  [
    "a numeric display formula followed by another display formula",
    "$$42$$ と $$x = 1$$",
  ],
  ["a display formula immediately after a label", "Result:$$x = 1$$"],
  ["a display formula immediately after a colon", "考える: $$x$$"],
  [
    "a display formula after non-math double dollar signs",
    "run echo $$; kill $$ after 2 seconds.\n\n$$x = 1$$",
  ],
  [
    "a display formula after double dollar signs spanning a newline",
    "run echo $$;\nkill $$ after 2 seconds.\n\n$$x = 1$$",
  ],
  [
    "a display formula after introductory dollar signs and a monetary amount",
    "前置き $$ は数式ではありません。\n$$100 です。\n\n$$x = 1$$",
  ],
  [
    "a display formula after a monetary amount",
    "前置き $$ は数式ではありません。\n価格は $$100\n\n$$x = 1$$",
  ],
];

test("the oracle recognizes display formulas as math", () => {
  assert.equal(piSeesMath("$$x^2$$"), true);
});

test("the oracle does not recognize monetary amounts as math", () => {
  assert.equal(piSeesMath("$$100"), false);
});

test("the oracle returns unknown for unrenderable display formulas", () => {
  assert.equal(piSeesMath(String.raw`$$\notacommand{x}$$`), undefined);
});

for (const [name, markdown] of PLAIN_FOR_PI) {
  test(`Pi is known not to recognize math in ${name}`, () => {
    assert.equal(piSeesMath(markdown), false);
  });

  test(`${name} is not converted to display math when Pi sees no math`, () => {
    assert.deepEqual(displayFormulasIn(markdown), []);
  });
}

for (const [name, markdown] of AGREES_WITH_PI) {
  test(`formulas Pi keeps as prose are not rendered as images in ${name}`, () => {
    assert.deepEqual(formulasPiKeptAsText(markdown), []);
  });
}

for (const [name, markdown, expected] of PI_FORMULA_ONLY) {
  test(`Pi does not recognize display formulas in ${name} as math`, () => {
    assert.equal(piSeesMath(markdown), false);
  });

  test(`display formulas in ${name} are intentionally rendered as images despite Pi seeing no math`, () => {
    assert.deepEqual(displayFormulasIn(markdown), [expected]);
  });
}
