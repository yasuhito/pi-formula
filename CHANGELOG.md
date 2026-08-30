# Changelog

## 0.1.0 - Unreleased

- Add the CommonJS TypeScript foundation for rendering display formulas as transparent MathJax PNG images.
- Add a Pi 0.84 extension that keeps inline formulas in Unicode text and renders display formulas as images in Ghostty and Kitty.
- Preserve ordinary Markdown, code, money, URLs, shell variables, streaming input, lists, and quotes while detecting formulas.
- Add `/formula status` and local-tarball discovery coverage against the real Pi runtime.
- Bound formula input, image cells, and the in-memory result cache; cache failures and fall back to text per formula.
- Delay MathJax and Resvg until the first display formula and follow the current exact theme RGB and display width.
