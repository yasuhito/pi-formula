# Domain glossary

## pi-formula

**pi-formula**:
An independent, general-purpose extension that renders common LaTeX formulas in Pi conversations for readability. It does not assume knowledge or macros from a specific field such as quantum computing.
_Avoid_: qni-math, quantum-computing-only math extension

**Inline math**:
Math placed within prose using `$...$` or `\(...\)`. Always rendered as Unicode text, just like the surrounding prose.
_Avoid_: inline math images

**Display math**:
Math placed on lines separate from prose using `$$...$$` or `\[...\]`. Rendered as MathJax images on image-capable terminals and as Unicode text on terminals that cannot use images.
_Avoid_: block math

**Image path**:
The path that typesets display math into images and renders them using the terminal's image protocol. Ghostty and Kitty are the first terminals with guaranteed image support.
_Avoid_: image mode, Kitty mode

**Text path**:
The path that renders math using Pi's standard Unicode text. Always used for inline math, and also for display math when images are unavailable.
_Avoid_: Unicode mode, degraded display

**User macros**:
LaTeX commands added through user settings. pi-formula provides a general user macro mechanism but does not include field-specific commands by default.
_Avoid_: pi-formula standard quantum macros

**Additional macros**:
Field-specific LaTeX commands passed to pi-formula by another Pi extension. qni-cli passes quantum macros as additional macros.
_Avoid_: pi-formula built-in quantum macros

**Real-display verification**:
Verification that captures display math rendered through the image path from an actual terminal screen and distinguishes display defects from failures in the verification procedure.
_Avoid_: display verification, screenshot tests

**Display plan**:
The result of calculating the required output height from the corpus, rendering path, and terminal widths to capture before real-display verification, and deciding whether the entire history fits in the capture.
_Avoid_: height estimate, screen size calculation

**Corpus mode**:
A real-display verification mode that has the model respond with a saved Markdown corpus verbatim, checking response equality and the actual display for regressions.
_Avoid_: echo mode, regression mode
