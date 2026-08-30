# Formula for Pi

Readable LaTeX in Pi: terminal-native inline math and MathJax display images.

Formula for Pi keeps inline formulas such as `$x^2$` and `\(x^2\)` in Pi's Unicode text renderer. In Ghostty and Kitty, display formulas such as `$$x^2$$` and `\[x^2\]` are rendered as transparent MathJax PNG images. Other terminals and non-interactive modes keep Pi's text rendering.

The extension changes only the displayed Markdown. Saved messages and the model context retain the original LaTeX.

## Markdown safety

Formula for Pi recognizes only `$...$`, `\(...\)`, `$$...$$`, and `\[...\]`. It leaves code fences, inline code, thinking, escaped dollar signs, ordinary money, URLs, shell variables, ambiguous dollar signs, and incomplete formulas unchanged. Closed display formulas can appear while a response is streaming, and display formulas keep their list or quote nesting.

If one display formula is invalid, Formula for Pi leaves that formula as LaTeX and continues rendering the rest of the message.

## Try a local tarball

Requires Pi 0.84 or later and Node.js 22.19 or later.

```sh
npm pack
pi install npm:pi-formula@file:./pi-formula-0.1.0.tgz
```

Formula for Pi checks terminal image support with a PNG query. Ghostty and Kitty responses select the image path. A rejected or unanswered query, tmux, screen, and non-interactive Pi modes select the text path without sending terminal controls.

## Display path command

Use `/formula` with one of these actions:

- `status` shows the version, active path, selection reason, terminal, macro count, in-memory cache size, and latest failure.
- `image` or `text` selects a path for the current session.
- `auto` returns the current session to automatic selection.
- `clear` removes rendered images and failures from the in-memory cache.

Add `--default` to `image`, `text`, or `auto` to update the global default. Formula for Pi writes only explicit defaults to `${XDG_CONFIG_HOME:-~/.config}/pi-formula/config.json`; `auto --default` removes the saved path. Without `--default`, a path selection is saved only in the current Pi session.
