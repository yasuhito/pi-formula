# ADR 0001: Use public Pi APIs to render inline and display math differently

## Context

Pi 0.84 and later can render LaTeX in prose as Unicode text. MathJax images make complex typesetting readable in a paper-like form, but small images within prose look fainter than text and make copying, searching, wrapping, and baselines unnatural.

Some earlier image extensions rewrite Pi's internal Markdown rendering. This gives fine-grained control over placement but depends on private internals and is vulnerable to Pi updates.

## Decision

Use only public APIs in Pi 0.99 and later. Pi 0.99.0 is the first release with the theme color APIs the image path uses for its text color (`colorToHex` and `Theme.colors`). Change only the on-screen display, without changing saved conversations or the LaTeX passed to the model.

- Always leave inline math on Pi's standard Unicode text path.
- Convert display math into images with MathJax and Resvg on image-capable terminals.
- Fall back to the Unicode text path for display math when images are unavailable.
- Ghostty and Kitty are the first terminals with guaranteed image support.
- Use the public Kitty Unicode placeholder specification for image placement.
- Render closed display math through the image path even during streaming. Leave incomplete display math on the text path. Previously, display math stayed on the text path until the response was finalized, to avoid differential rendering separating transfer lines from placeholder lines. #92 removed that wait and measured incremental updates of Issue 26, including preceding tool output. In each completed frame, virtual placements and placeholder image IDs matched, and no frame had APC fragments in body cells. These results justified removing the wait; streaming protocol checks continue to verify the same state.
- Place image transfer chunks immediately before each placeholder, separated so that Pi's Markdown renderer does not merge them onto the same rendered line as other body content. A cache does not guarantee the image still exists in the terminal, so retransmit even the same image ID for each placement.
- Do not rewrite Pi's internal functions or prototypes.

## Protocol and real-display verification constraints

- The order of Kitty row and column diacritics follows the [upstream coordinate table](https://github.com/kovidgoyal/kitty/blob/master/gen/rowcolumn-diacritics.txt). The tables in `src/kitty.ts` and native verification must maintain the same order; `test/diacritics.test.ts` compares all coordinates against C output.
- The native verification terminal writes responses to Kitty `a=q`, DA, DSR, and similar requests back to the PTY. Discarding responses leaves Pi's terminal probe waiting indefinitely, preventing rendering.
- Real-display verification cleanup stops the entire process group. On macOS, signaling an unreaped group whose members have all exited returns `EPERM` rather than `ESRCH`, so treat either as already stopped. Use `ps` state to distinguish unreaped exited processes (`Z`) from running processes.

## Consequences

Prose and inline math have the same size, weight, and baseline, retaining copying, searching, and wrapping. Complex display math can use image-based typesetting. In exchange for avoiding Pi's private implementation, older Pi versions and unverified image protocols are not guaranteed.

## Alternatives considered

- Render all math as images: rejected because it harms inline readability and interaction with prose.
- Render all math as Unicode: rejected because it does not meet the goal of paper-like typesetting for display math such as fractions, sums, and matrices.
- Rewrite Pi's internal Markdown rendering: rejected because the increased placement freedom depends on private APIs.
