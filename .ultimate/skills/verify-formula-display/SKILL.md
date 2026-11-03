---
name: verify-formula-display
description: Verify pi-formula in real Ghostty or Kitty, including comparisons between package or Pi versions. Use for formula display regressions, compatibility checks, screenshots, streaming, scrolling, or reflow verification.
---

# Verify formula display

Use the existing verification tools, not a new runner or dashboard. Read `../../../README.md` for project setup, then the authoritative project documents:

- `../../../docs/agents/verify-display.md`: capture commands, result states, artifacts, isolation, and visual judgment.
- `../../../docs/agents/libghostty-vt.md`: native build, protocol checks, and skip behavior.
- `../../../CONTEXT.md` and relevant `../../../docs/adr/`: scope and rendering constraints.

Resolve these paths relative to this skill directory. Do not duplicate their implementation or invent new CLI options.

## Establish the target

1. Check Git status and identify the checkout commit. Preserve user edits.
2. Record the actual Pi executable and version, terminal version, and pi-formula source. Distinguish the lockfile's Pi dependencies, the Pi CLI on PATH, an isolated Pi installation, and Ultimate's own Pi dependencies.
3. For a published-package comparison, verify the installed package version and resolve its extension path. Use the existing `--extension` option; do not silently test main instead of the published package.
4. Select the smallest existing corpus that exercises the reported behavior. Keep comparison inputs, terminal dimensions, and themes consistent.
5. Check available disk space and required terminal/native dependencies before expensive preparation. Do not stop unrelated processes or change system limits.

## Choose verification deliberately

- Run build-producing commands sequentially within each checkout. Concurrent builds and cleanup can remove one another's generated files.
- Use the documented encoder, Pi, and streaming protocol checks for deterministic protocol facts. Verify their actual output: missing native binaries can produce exit code zero while **skipping** checks. A command listed in `protocolChecks` is not by itself evidence that native inspection ran.
- Use real Ghostty or Kitty for visual conclusions. A browser rendering or libghostty-vt state inspection is not a real-terminal screenshot.
- The standard corpus capture asks a model to reproduce Markdown and can incur model charges. Explain that before running it unless the user has already authorized that cost. Prefer existing offline fixtures or saved-session replay when they exercise the requested behavior without model calls; report that method and its limitations.
- Do not install or upgrade the user's global Pi or alter shared terminal settings merely to test another version. Prefer an isolated installation and dedicated headless terminal environment.

## When terminal probe behavior changes

For changes to `src/terminal-probe.ts` that affect response parsing, chunk boundaries, timeout, or settlement, also read `../../../verification/terminal-probe/README.md` and run its isolated manual model checks and current-source replay. Follow that document for the supported Node version, dependency installation, commands, bounds, and artifacts; do not add these checks to normal CI.

Confirm the current model succeeds, both intentional mutants produce the expected invariant violations, and replay against the actual current implementation succeeds. Tool errors and missing inputs are failures, not counterexamples or skips. If using historical reproduction, distinguish its expected failure from current-source success and regenerate the current report afterward.

Report model bounds and implementation correspondence explicitly. These checks do not prove arbitrary input preservation or replace real-terminal and protocol verification. Do not run them for unrelated visual or documentation changes.

## Capture and inspect

Follow the capture document's commands and isolation rules. Store temporary corpora, logs, screenshots, and recordings outside the repository. Do not commit one-off artifacts unless explicitly requested.

Inspect the actual PNGs with the image-reading tool. Check formula readability, color, clipping, placement, neighboring prose, and relevant list or quote nesting. For comparisons, inspect both versions under the same conditions.

Exercise only the interactions relevant to the request, such as incomplete versus closed streaming formulas, width fallback, reflow, scroll clipping and restoration, or image versus text paths. Distinguish fixture-driven Pi rendering from live model streaming.

A `captured` result means capture completed, not that the display is correct. Never implement pixel pass/fail logic. Show the images so the user can make the final visual judgment.

## Handle failures honestly

Preserve the original result and diagnostics. Distinguish input rejection, preparation or launch failure, protocol failure, and an observed visual defect.

If a large headless screen cannot launch, investigate its diagnostic and try a smaller, focused real-terminal reproduction using existing procedures. Do not label that substitute as a successful full-corpus capture. State which history, dimensions, and interactions remain unverified.

Do not silently loosen assertions, increase timeouts, or disable checks to obtain success. Reproduce suspected product bugs in the real terminal before proposing a fix. Keep product fixes and dependency updates outside a verification-only request unless authorized.

## Report

Return a concise result with:

- Checkout commit, pi-formula package/source version, actual Pi and terminal versions.
- Corpus or replay source, theme, path, dimensions, and whether a model was called.
- Checks actually executed, skipped checks, exit results, and artifact locations.
- Images inspected and the visible observations, separate from protocol facts.
- Failures, substitute procedures, and unverified cases, without turning partial coverage into a blanket compatibility claim.
- Any repository changes. No automatic push, release, or publication.
