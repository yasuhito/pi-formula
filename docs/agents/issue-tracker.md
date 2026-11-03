# Issue tracker: GitHub

Manage this repository's tasks and specifications in GitHub Issues. Use the `gh` CLI for all operations.

## Operations

- Create: `gh issue create --title "..." --body "..."`
- Read: `gh issue view <number> --comments`
- List: `gh issue list --state open --json number,title,body,labels,comments`
- Comment: `gh issue comment <number> --body "..."`
- Label: `gh issue edit <number> --add-label "..."`
- Complete: `gh issue close <number> --comment "..."`

Determine the repository from `git remote -v`. "Publish to the issue tracker" means creating a GitHub Issue.

## Pull requests

Do not treat external pull requests as an intake surface for triage requests. Issues and pull requests share the same numbering space, so check an ambiguous number with both `gh pr view` and `gh issue view`.

## Sub-issues and dependencies

Use GitHub sub-issues to split work into multiple tasks. Express work order with GitHub dependencies; only when dependencies are unavailable, record them in a `Blocked by:` line in the issue body. Issues without unfinished dependencies or an assignee are candidates for the next task.

## Implementation contract

Include these sections in the body of an issue handed to automated implementation.

- `## What to build`: what to change and how
- `## Acceptance criteria`: a checklist of verifiable conditions
- `## Out of scope` (optional): what this issue will not do

## Automation loop labels

| label | Meaning |
| --- | --- |
| `agent:implement` | Together with `ready-for-agent`, tells the issue coordinator to hand the issue to a worker |
| `agent:in-progress` | A worker is implementing the issue |
| `agent:waiting-dependency` | Waiting for dependency issues to finish; automatically returns to `agent:implement` once all dependencies close |
| `agent:blocked` | Automation is stopped; do not rerun until a human checks the cause |
| `agent:review` | The PR is awaiting review |
| `agent:reviewing` | The PR reviewer is reviewing the PR |

See `docs/agents/automations/` for automation definitions.
