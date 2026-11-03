---
summary: Build libghostty-vt from a pinned version and inspect protocol state
read_when:
  - Updating the libghostty-vt pin or vt-pty
  - Adding image-path protocol checks
---

# libghostty-vt protocol checks

`vt-pty` starts a child process in a PTY and feeds its output into libghostty-vt. Once rendering settles, or a synchronized-output end boundary arrives after the required virtual placements, it writes Kitty image placements and terminal cell state to standard output. `WRITE_PTY` responses are written back to the PTY. The PNG decoder reads only the IHDR dimensions and returns zero-filled RGBA.

## Build

Requires Zig 0.16.0 and a C compiler.

```sh
scripts/build-vt-pty
```

The default artifacts go under `$XDG_CACHE_HOME/pi-formula/libghostty-vt/<commit>/prefix`, or under `~/.cache` if `XDG_CACHE_HOME` is unset. To use another location:

```sh
scripts/build-vt-pty --prefix "$HOME/.local/state/pi-formula-native"
```

The build uses the single line in `native/libghostty-vt.commit` as its only version input. It checks out that Ghostty commit and installs into the specified prefix with:

```sh
zig build -Demit-lib-vt -Doptimize=ReleaseFast --prefix <dir>
```

Compilation of `vt-pty` explicitly uses `<dir>/include` and `<dir>/lib`. It does not use system libghostty-vt or `pkg-config`. Add `--print-plan` to inspect only the build plan, without cloning, building, or creating files.

CI caches only the expensive libghostty-vt headers and library per pin. The executable built from `native/vt-pty.c` and `native/diacritics.h` is not cached; it is compiled from the current checkout each time.

## Run and skip

```sh
scripts/run-vt-pty.js -- <command> [args...]
```

The entry point searches `PI_FORMULA_VT_TOOL` first, then `vt-pty` in the default cache. If neither has an executable, it skips protocol checks successfully and reports the skip on standard output. Normal `npm run check` does not require native artifacts.

Without a placement count, it emits protocol state after the child's output settles. With `--wait-for-render-boundary`, it reads the PTY until the synchronized-output end boundary `ESC[?2026l` arrives after the required virtual placements. This feeds libghostty-vt placeholders and body content split into separate reads from placement APCs, without waiting for all output to settle if more output follows the boundary.

`--wait-for-child-exit` waits for successful child exit rather than output quiescence. Use it when output after a response cannot be inferred from a quiet interval, such as short-lived fixtures that verify receipt of terminal responses.

With `--frames`, every PTY read emits `frame.complete` for synchronized-output completion, `frame.kitty_open` for an ongoing Kitty APC, Kitty storage and virtual placements, placeholder cells, and APC fragments in body cells. The traditional final state is also emitted at the end. Timeouts, launch failures, PTY I/O failures, and required libghostty-vt API failures exit with code 2.

Native-only Cucumber scenarios search in the same order. The dedicated CI job sets `PI_FORMULA_VT_TOOL` and runs these scenarios.

## Encoder-layer protocol checks

```sh
npm run verify:encoder-protocol
```

This entry point first builds the current checkout. It then selects the image path with `test/support/fake-pi.js` and feeds bytes emitted by the Markdown transformer directly to `vt-pty`. It does not start Pi or a model. To isolate checks from user settings and terminal environment, it points `XDG_CONFIG_HOME` at a temporary directory, empties `PI_FORMULA_MACROS`, unsets `TMUX`, and fixes `TERM` to an image-path value. It checks storage images, virtual placements, and placeholder cell image IDs, coordinates, and underline color tags. It transforms the same Markdown twice and confirms that the second output also creates images in a fresh terminal's storage.

It reads PNG transfer format `f=100` and IHDR dimensions as the transfer plan and compares them with libghostty-vt storage. Because libghostty-vt stores PNG-decoded images as RGBA, storage is expected to have a format normalized to RGBA. For each U+10EEEE cell, `vt-pty` emits the image ID reconstructed from foreground RGB and the row and column reconstructed from diacritics.

Pass `storage`, `placement`, `image-id`, `coordinates`, `underline`, or `cached` to `--check` to check only that item. `missing-transfer` is a regression check with image transfers removed; it fails because no virtual placement exists for the ID referenced by the placeholder. If `vt-pty` is unavailable, the check skips successfully. Run implementation-contract scenarios with `npm run test:native-vt`.

## Protocol checks through Pi

```sh
npm run verify:pi-protocol
```

This check creates a temporary session from `docs/agents/verify-corpus/issue-52.md` and opens it with `pi --session`. Pi starts with `--offline` and only renders saved assistant messages, without calling a model. Automatic extension discovery, tools, skills, prompt templates, context files, and themes are disabled. Settings are isolated in a temporary `XDG_CONFIG_HOME`, with user macros cleared by `PI_FORMULA_MACROS='{}'`.

Pi's TUI wraps each render in `ESC[?2026h` and `ESC[?2026l`. After receiving virtual placements for all display math, the check reads through the synchronized-output end boundary following that Kitty APC and inspects state without waiting for PTY output to stop. This boundary establishes that placeholders and body content in the same render have been processed. Even if initial typesetting pauses output, it does not finalize until both placements and boundary arrive. The deadline for placements and boundary is 15 seconds. If placements are incomplete, it recounts them at timeout and fails with exit code 2, reporting `vt-pty: timeout 15000ms waiting for ... placements` with required and observed counts. If placements are complete but no boundary arrives, it reports `waiting for render boundary`.

Any of the following fails with exit code 1:

- A placeholder cell has `faint`, a background color, or `inverse`
- A virtual placement's image ID has no corresponding placeholder cell
- An APC ESC or ST remains in a body cell
- The number of display math expressions differs from the number of virtual placements with an image in storage

If `vt-pty` is unavailable, the check skips successfully, like normal protocol checks. Run implementation-contract regression scenarios with `npm run test:native-vt`.

## Streaming protocol checks

```sh
npm run verify:streaming-protocol
```

Using Pi's public Markdown transformer and `TuiMainScreen`, the check extends Issue 26's incomplete body three times while retaining preceding tool output, then renders the finalized body. Closed display math uses the image path on each update. Differential writes generated by the TUI, rather than full-screen redraws, are passed to `vt-pty` unchanged in sequence. It checks for zero APC fragments in body cells in every frame recorded by `vt-pty --frames`. In each completed frame, it checks that virtual placements and placeholder image IDs match. In the final frame, it also checks that display math and virtual placements with storage have matching counts.

This verifies over time the path specified by ADR 0001: closed display math uses the image path even while streaming. The three incremental updates retain preceding tool output while virtual placements increase from one to two to three. Finalization retains the same three. Even if Kitty APCs cross PTY read boundaries, completed frames contain the corresponding placeholders and leave no APC fragments in body cells.

If `vt-pty` is unavailable, the check skips successfully. Native-only Cucumber scenarios independently check multiple frames, APCs across all frames, and the final frame.

## Updating the pin

Update the pin in a separate PR. Check the following before and after:

1. Read changes to `terminal.h`, `render.h`, `style.h`, and `kitty_graphics.h` under `include/ghostty/vt/`.
2. Confirm Tier A and Tier B checks pass.
3. Confirm build time and artifact size have not changed drastically.
