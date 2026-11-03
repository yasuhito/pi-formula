# Checking session records for tool failures

`scripts/verify-session-tools.js` deterministically extracts tool failures, unsupported functionality, interrupted batches, and switches to alternatives from Pi session records that may not be apparent from the display alone.

## Run

Specify the JSONL file for a session started by the verification harness.

```sh
npm run verify:session-record -- ~/.pi/agent/sessions/<project>/<session>.jsonl
```

The exit code is 0 for no hits, 1 for hits, and 2 for failures reading or parsing arguments, JSONL, or the ignore list. Each hit shows its kind, tool, command, JSONL line number, and one line of context on either side. Long context lines are truncated at 300 characters.

The following are detected:

- Nonzero exits reported as `exited with status N`, `exited with code N`, or `Command exited with code N`
- Tool output containing `未対応`, `対応していない`, `unsupported`, or `not supported`
- Interrupted batches reported as `Stopped at command N of M`
- Assistant text containing `代わりに`, `代替手段`, `切り替え`, or `fallback` immediately after a failed tool execution

For batched command records, the relevant command is determined from `$ ...` immediately before the tool output, or the Nth command in `Stopped at command N of M`. Command names reconstructed from `commands` use the name of that tool call. Only tool results containing a failure, unsupported functionality, or an interrupted batch, or with `isError` set to true, are candidates for fallback detection. Each candidate is consumed by inspecting only the next assistant message, so unrelated expressions after successful results or in later turns are not associated with it.

## Ignore list

Exclude known, accepted hits with a JSON ignore list.

```json
{
  "ignore": [
    {
      "kind": "unsupported",
      "tool": "qni",
      "command": "qni run --symbolic",
      "pattern": "unsupported symbolic gate column"
    }
  ]
}
```

```sh
npm run verify:session-record -- \
  --ignore=path/to/ignore-list.json \
  ~/.pi/agent/sessions/<project>/<session>.jsonl
```

Each entry must specify one or more of `kind`, `tool`, `command`, and `pattern` as nonempty strings. Only hits matching all specified conditions are excluded. `pattern` is applied to the matched line as a case-insensitive regular expression. Empty conditions are rejected as configuration errors with exit code 2.

Kind values are `nonzero-exit`, `unsupported`, `stopped`, and `fallback suggested`. Migrate existing ignore lists from `非 0 終了` to `nonzero-exit`, `機能不足` to `unsupported`, `途中停止` to `stopped`, and `代替手段` to `fallback suggested`. There is no compatibility shim for the old kind values. Japanese input detection terms remain supported as listed above.

## Relationship to display checks

Real-display verification captures screens for visual review, while session record checks examine records to determine whether tools worked as expected. They inspect different surfaces.

Corpus mode in real-display verification starts Pi with `--no-tools` and retains session JSONL in the per-run artifact directory. Inspect the record from the directory in a `captured` or `failed` result as follows:

```sh
npm run verify:session-record -- path/to/persisted-session.jsonl
```

Session record checks create no windows and do not interfere with display checks or cleanup performed by a separate headless harness.
