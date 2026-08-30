# Formula for Pi

Readable LaTeX in Pi: terminal-native inline math and MathJax display images.

Formula for Pi keeps inline formulas such as `$x^2$` and `\(x^2\)` in Pi's Unicode text renderer. In Ghostty and Kitty, display formulas such as `$$x^2$$` and `\[x^2\]` are rendered as transparent MathJax PNG images. Other terminals and non-interactive modes keep Pi's text rendering.

The extension changes only the displayed Markdown. Saved messages and the model context retain the original LaTeX.

## Markdown safety

Formula for Pi recognizes only `$...$`, `\(...\)`, `$$...$$`, and `\[...\]`. It leaves code fences, inline code, thinking, escaped dollar signs, ordinary money, URLs, shell variables, ambiguous dollar signs, and incomplete formulas unchanged. Closed display formulas can appear while a response is streaming, and display formulas keep their list or quote nesting.

If one display formula is invalid, Formula for Pi leaves that formula as LaTeX and continues rendering the rest of the message.

## Macros

Put persistent user macros in `$XDG_CONFIG_HOME/pi-formula/config.json` (or `~/.config/pi-formula/config.json`):

```json
{
  "macros": {
    "RR": "\\mathbb{R}",
    "pair": ["\\left(#1,#2\\right)", 2]
  }
}
```

`PI_FORMULA_MACROS` accepts the `macros` object itself as JSON and overrides names from the file. An invalid JSON source is ignored. An invalid individual definition is ignored without disabling the other definitions.

## Extension API

The CommonJS package exports only `registerFormula` and synchronous `createFormulaPng` operations. Another Pi extension can register protected additional macros and create a display-formula PNG through the same rendering path:

```js
const { createFormulaPng, registerFormula } = require("pi-formula");

registerFormula(pi, {
  ket: ["\\left|#1\\right\\rangle", 1]
});

const image = createFormulaPng(pi, "\\ket{0}", availableWidth);
```

`image` is `undefined` on the text path. On the image path it contains PNG `data`, pixel content size, and terminal column and row counts; it does not contain a Pi UI component. Additional macros override user macros and remain protected when standalone and bundled copies register in either order.

## Try a local tarball

Requires Pi 0.84 or later and Node.js 22.19 or later.

```sh
npm pack
pi install npm:pi-formula@file:./pi-formula-0.1.0.tgz
```

Use `/formula status` to show the package version and the active `image` or `text` path.
