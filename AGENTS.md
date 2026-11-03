# AGENTS.md

## Domain docs

Treat this repository as a single context, using the root `CONTEXT.md` and `docs/adr/`. See `docs/agents/domain.md` for details.

## Code comments

Use names and structure instead of explanatory comments. Put protocol provenance and non-obvious platform constraints in `docs/adr/`. `npm run lint` checks handwritten JavaScript/TypeScript under `src/`, `scripts/`, `test/`, and `features/`; only exact `// See docs/adr/<existing-file>.md` references and reasoned `biome-ignore` directives are allowed. Generated JavaScript siblings of TypeScript are excluded. Native C and the legacy shell/Python automation documents are not parser-linted; preserve necessary machine directives and upstream notices rather than removing them to satisfy this policy.

## Tests

- Limit each test case to one assertion. Count each Node Test Runner `test(...)` and each Cucumber Scenario as one test case.
- When two or more assertions are needed, split them into separate test cases and extract only shared setup into helpers or hooks. Assertions hidden in helpers still count toward this limit.
- Do not combine unrelated expectations into one aggregate assertion solely to satisfy the assertion limit. Restrict Given and When to setup, and put result assertions in Then.
- Tests of verification tools must run the tool and observe its results. Check the exit code, output, and generated artifacts. Do not add tests that use `readFileSync` to read implementation, CI configuration, or documentation and inspect the presence or order of strings. Literal text is not behavior, so such tests fail merely because a variable is renamed, a command is reformatted, or documentation is rewritten. If something to verify exists only in configuration or documentation, add a way for the tool to print its resolved configuration and inspect that output.
- Do not determine pixel-level pass or failure in code. `npm run verify:display -- <corpus>` automates the process through capturing the images, while a person judges the result visually, so do not invest in logic that determines whether an image is correct. Facts defined by the specification, such as protocol state, may be checked in code.

## Maintaining this file

Keep this file for knowledge useful to almost every future agent session in this project.
Do not repeat what the codebase already shows; point to the authoritative file or command instead.
Prefer rewriting or pruning existing entries over appending new ones.
When updating this file, preserve this bar for all agents and keep entries concise.
