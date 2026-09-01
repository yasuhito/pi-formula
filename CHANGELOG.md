# Changelog

## 0.1.0 - Unreleased

- Add the CommonJS TypeScript foundation for rendering display formulas as transparent MathJax PNG images.
- Add a Pi 0.84 extension that keeps inline formulas in Unicode text and renders display formulas as images in Ghostty and Kitty.
- Preserve ordinary Markdown, code, money, URLs, shell variables, streaming input, lists, and quotes while detecting formulas.
- Add `/formula status` and local-tarball discovery coverage against the real Pi runtime.
- Add XDG and environment user macros plus a protected additional-macro and synchronous PNG API for other Pi extensions.
- Add public display-path detection and bounded, validated Kitty rendering for PNG buffers and regular files created by other extensions.
- Bound formula input, image cells, and the in-memory result cache; cache failures and fall back to text per formula.
- Delay MathJax and Resvg until the first display formula and follow the current exact theme RGB and display width.
- Add English and Japanese installation guides, a Ghostty preview, support and coexistence notes, dependency audit details, and an intentionally limited npm tarball.
- Let an explicit session `auto` preference bypass the saved global default and return display-path selection to the terminal probe.
