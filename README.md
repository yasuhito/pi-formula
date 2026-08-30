# Formula for Pi

Readable LaTeX in Pi: terminal-native inline math and MathJax display images.

Formula for Pi keeps inline formulas such as `$x^2$` and `\(x^2\)` in Pi's Unicode text renderer. In Ghostty and Kitty, display formulas such as `$$x^2$$` and `\[x^2\]` are rendered as transparent MathJax PNG images. Other terminals and non-interactive modes keep Pi's text rendering.

The extension changes only the displayed Markdown. Saved messages and the model context retain the original LaTeX.

## Try a local tarball

Requires Pi 0.84 or later and Node.js 22.19 or later.

```sh
npm pack
pi install npm:pi-formula@file:./pi-formula-0.1.0.tgz
```

Use `/formula status` to show the package version and the active `image` or `text` path.
