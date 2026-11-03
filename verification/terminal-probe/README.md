# Terminal probe finite-model verification

Independent, private manual verification with npm `tla-ts@0.0.6` ([upstream](https://github.com/aidenybai/tla-ts)). The lock pins the registry release and fflate with npm integrity. No JVM is required. No comparison with TLC or independent validation of tla-ts was performed.

## Run

From the repository root, using Node 26 (verified on v26.12.1):

```sh
npm --prefix verification/terminal-probe ci --ignore-scripts
node verification/terminal-probe/run.mjs
node verification/terminal-probe/replay.mjs
```

Scripts locate their inputs relative to `import.meta.url`, so they also work from another working directory. Replay loads the actual `../../src/terminal-probe.ts`, not a copied implementation, using Node's experimental `stripTypeScriptTypes` API. It also uses Node mock timers for the 300ms timeout; these APIs require a compatible Node version, not a transpiler dependency. This is not a real-terminal or wall-clock test.

Historical reproduction, also from the repository root:

```sh
git show c0a111071509d55a3c758f8b07a1ba09e3ba7404:src/terminal-probe.ts > verification/terminal-probe/output/historical-terminal-probe.ts
PROBE_SOURCE=verification/terminal-probe/output/historical-terminal-probe.ts node verification/terminal-probe/replay.mjs
```

This immutable target is the parent of fix 19855fd. **Failure is expected**: the same completed-response trace fails the first path assertion (`pending` instead of `image`). `PROBE_SOURCE` overrides the actual source path; relative overrides resolve against the process working directory. A missing source is an error, never a skipped historical check. Run the current-source replay again to refresh its success report after historical experiments.

## Bounds and correspondence

One PNG query, fixed id 1900000000, byte-valued prefix and ESC-backslash terminator. Eight wires: OK/EINVAL with ordinary `u` or prefix-like `u ESC v` before the frame and `v` after it; lone ESC, ESC-underscore, mismatching ESC-v, and a wrong-id reply. Maximum wire length is 28 bytes. These are examples, **not all strings** up to that length.

For each wire the model explores every nonempty contiguous chunk partition and timeout before or between callbacks, including after the final chunk. State merging discards chunk history. Each callback and finish operation is atomic, matching the single-threaded JS event loop. Input after unsubscribe bypasses the listener unchanged. No synchronous callback from addInputListener, thrown UI/parser operation, concurrent query, id wrap, shutdown or captured stale callback is modeled.

Timeout is weakly fair: it eventually executes if continuously enabled. Eventual settlement assumes scheduler progress, not a 300ms wall-clock bound. Settlement disables timeout, reflecting clearTimeout.

| Model | `src/terminal-probe.ts` |
| --- | --- |
| pending, response, result | pendingPrefix, response, Promise result |
| SuffixLength, Keep, Pass | possiblePrefixSuffix and withheld candidate suffix |
| Input, First, collected, leading, trailing | listener and completeResponse |
| active, resolutions, Timeout | unsubscribe, settled/finish, timeout callback |
| CompleteInput, UnmatchedInput | final path and completed/unmatched input conservation |
| TimeoutBeforeFrame, TimeoutInFrame, TimeoutTail | expected timeout output and subsequent listener bypass |

Ambiguity is intentional: candidate prefix suffixes and unfinished matched frames are withheld and **not flushed at timeout**. Earlier ordinary bytes must already have been returned; subsequent bytes pass raw. Lone ESC can disappear, and the tail of a late response can reach ordinary input. This records current behavior, not arbitrary-input preservation or a decision to drain late responses.

## Results and artifacts

`run.mjs` asserts current success and two mutant invariant violations. Mutate=TRUE drops prefix suffixes shorter than ESC-underscore-G (3 bytes), representing the historical boundary bug class rather than the entire old algorithm. The first check retains every invariant and violates TimeoutBeforeFrame. The second omits only timeout-policy invariants to obtain CompleteInput's completed-response counterexample. The normal check's properties are unchanged.

That trace splits `u ESC` from `_Gi=1900000000;OK ESC backslash v`. The mutant leaks the wire and remains pending. Actual current source must yield image, `uv`, one unsubscribe and no listener. Replay also checks all three-chunk partitions of four complete wires (1114 schedules) and all still-pending timeout boundaries across eight wires (130 schedules). This is a bounded cross-check, not equivalence proof; the model explores more partitions than replay.

Generated model, cfg, cases and JSON reports go in ignored `output/`. The current model previously reached 1846 distinct / 15720 generated states. Parser/config/evaluation errors, status=error and assertion failures are tool/run failures, not counterexamples. Only expected invariant violations count as mutation evidence. No real-terminal, pixel, MathJax, Pi streaming or image-cache verification is provided here. Root package publication excludes this directory; no root dependencies, scripts or CI integration are needed.
