# Formula for Pi

Readable LaTeX in Pi: terminal-native inline math and MathJax display images.

Formula for Pi keeps inline formulas such as `$x^2$` and `\(x^2\)` in Pi's Unicode text renderer. In Ghostty and Kitty, display formulas such as `$$x^2$$` and `\[x^2\]` are rendered as transparent MathJax PNG images. Other terminals and non-interactive modes keep Pi's text rendering.

The extension changes only the displayed Markdown. Saved messages and the model context retain the original LaTeX.

## Markdown safety

Formula for Pi recognizes only `$...$`, `\(...\)`, `$$...$$`, and `\[...\]`. It leaves code fences, inline code, thinking, escaped dollar signs, ordinary money, URLs, shell variables, ambiguous dollar signs, and incomplete formulas unchanged. Closed display formulas can appear while a response is streaming, and display formulas keep their list or quote nesting.

If one display formula is invalid, exceeds the fixed character or image-cell limits, cannot obtain an exact theme RGB color, or would shrink below half size, Formula for Pi leaves that formula as LaTeX and continues rendering the rest of the message.

## Image safety

MathJax and Resvg are loaded only when the first display formula enters the image path. SVG and PNG data stay in a bounded in-memory cache; they are never written to disk. Cache identity includes the current theme color, available width, and terminal cell dimensions. Rendering does not use a network connection, browser, or child process.

The fixed limits are exported as `FORMULA_SAFETY_LIMITS`: 16,384 LaTeX characters, 255 image columns, 255 image rows, 64 cache entries, and 32 MiB of cached data. Failed formulas are cached too, so repeated invalid input is not typeset again.

## Try a local tarball

Requires Pi 0.84 or later and Node.js 22.19 or later.

```sh
npm pack
pi install npm:pi-formula@file:./pi-formula-0.1.0.tgz
```

Use `/formula status` to show the package version and the active `image` or `text` path.
