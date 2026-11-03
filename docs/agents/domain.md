# Domain docs

Treat this repository as a single context.

## Read before working

- Root `CONTEXT.md`
- The `docs/adr/` documents relevant to the work

If a file does not exist, continue without reporting it. Create it according to the domain-modeling rules once terminology or hard-to-reverse decisions have settled.

## Terminology

Use the canonical terms in `CONTEXT.md` when naming domain concepts in issues, specifications, tests, and code. Do not use terms marked as ones to avoid.

If a needed concept is missing from the glossary, do not invent an alias. Check whether the terminology is incomplete or the design has drifted.

## ADRs

Do not silently overwrite decisions when a change contradicts an existing ADR. State the conflict and the reason for reconsideration explicitly.

## Structure

```text
/
├── CONTEXT.md
├── docs/
│   └── adr/
└── src/
```
