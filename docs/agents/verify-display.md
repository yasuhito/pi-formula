---
summary: Capture a saved corpus in an isolated terminal for real-display verification of display math
read_when:
  - Running or changing real-display verification of display math
  - Checking the roles of corpus mode and protocol-layer verification
---

# Real-display verification of display math

Real-display verification has Pi render saved Markdown verbatim in Ghostty or Kitty and captures the entire history as PNG. This **corpus mode** distinguishes display defects from failures in the verification procedure.

## Run

Requires Linux, cage, wlr-randr, the selected terminal, grim, Node.js, and Pi. Without options, it uses the light theme, Ghostty, the image path, and `src/extension.ts` from the current checkout.

```sh
npm run verify:display -- docs/agents/verify-corpus/issue-21.md
npm run verify:display -- --theme dark --terminal kitty docs/agents/verify-corpus/issue-21.md
npm run verify:display -- --extension /tmp/package/src/extension.ts docs/agents/verify-corpus/issue-21.md
npm run verify:display -- --reflow 100 docs/agents/verify-corpus/issue-21.md
npm run verify:display -- --path text docs/agents/verify-corpus/issue-21.md
npm run verify:display -- --artifacts /tmp/pi-formula-captures docs/agents/verify-corpus/issue-21.md
```

`--theme` accepts `light` or `dark`, `--terminal` accepts `ghostty` or `kitty`, and `--path` accepts `image` or `text`. `--reflow <cols>` changes the output width after the initial capture and captures again after redrawing.

## Results

Standard output contains exactly one machine-readable JSON object.

| kind | code | Meaning |
| --- | ---: | --- |
| `captured` | 0 | Capture completed; artifacts are available for visual review |
| `rejected` | 1 | Input or display plan was rejected before rendering |
| `failed` | 2 | Preparation, launch, response verification, capture, or cleanup failed |

`failed.stage` is one of `prepare`, `launch`, `verify-response`, `capture`, or `cleanup`. Individual command details go into diagnostics, not stages. If cleanup fails after an earlier failure, the earlier stage is retained and `cleanupDiagnostics` is added.

## Artifacts

By default, a directory is created for each run under:

```text
${XDG_STATE_HOME:-$HOME/.local/state}/pi-formula/verify-display/
```

Change the parent directory with `--artifacts`. Every run retains `result.json`, adding `plan.json`, `protocol.json`, `session.jsonl`, terminal settings, diagnostic records, and `initial.png` according to the stages reached. A run using `--reflow` that reaches capture also retains `reflow.png`. Existing run results are never overwritten.

## Responsibilities for judging results

Automated checks cover only these facts:

- Pi's last completed assistant response matches the corpus
- The requested image or text path was selected
- The capture is PNG
- Capture dimensions match the display plan
- Consecutive captures match, indicating rendering has stabilized
- Image protocol state passes separate verification entry points

Do not determine display correctness from pixels in code. A person makes the final judgment of display math typesetting quality, colors, glyphs, and placement by inspecting the images returned by `captured`.

## Protocol verification

Use libghostty-vt to check image-path transfers, virtual placements, and placeholder cells deterministically. Real-display verification runs these three checks before capture and records successful checks in `protocol.json` and `captured.protocolChecks`.

```sh
npm run verify:encoder-protocol
npm run verify:pi-protocol
npm run verify:streaming-protocol
```

See [libghostty-vt protocol checks](libghostty-vt.md) for detailed checks.

## Isolation and safety

Start cage with `WLR_BACKENDS=headless` in a dedicated process group, without using the user's `WAYLAND_DISPLAY` or `DISPLAY`. Do not load user extensions, themes, settings, or tools; load only the current pi-formula, additional verification macros, and path verification.

Stop the dedicated process group on `SIGINT`, `SIGTERM`, `SIGHUP`, exceptions, and timeouts. Do not remove captured artifacts during cleanup. Production real-display verification supports only Linux headless Wayland; other environments fail at the `prepare` stage.

## Display plan

For both the normal and reflow widths, the display plan calculates the required height, including Markdown wrapping, display math image rows, and Pi's screen area. Corpora that do not fit within 16000px are `rejected` before rendering. `scripts/verify-display-plan.js` continues to handle display plan details.
