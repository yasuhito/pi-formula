# Orca automation definitions

`pi-formula issue coordinator` and `pi-formula PR reviewer` are registered as Orca automations. This directory holds the canonical prompts and prechecks; edit them here before applying updates to Orca. The configuration is based on the automations with the same names in `yasuhito/clawbar`.

| automation | id | prompt | precheck |
| --- | --- | --- | --- |
| pi-formula issue coordinator | `6eaaca9d-67be-4743-88a4-9e82e0659531` | `issue-coordinator.md` | `issue-coordinator.precheck.sh` |
| pi-formula PR reviewer | `4c2c4f81-0bdc-49a8-a52d-7237b9f4c002` | `pr-reviewer.md` | `pr-reviewer.precheck.sh` |

Both start agent `pi` every 10 minutes (`*/10 * * * *`, Asia/Tokyo) in the existing workspace `/home/yasuhito/Work/pi-formula`. The prompt runs only when the precheck exits with code 0; other results are recorded as skipped.

## Apply updates

```bash
orca-ide automations edit <id> --prompt "$(cat docs/agents/automations/issue-coordinator.md)" --json
orca-ide automations edit <id> --precheck "$(cat docs/agents/automations/issue-coordinator.precheck.sh)" --precheck-timeout 60 --json
```

## Enable and disable

```bash
orca-ide automations edit <id> --enabled --json
orca-ide automations edit <id> --disabled --json
orca-ide automations runs --id <id> --json
```

## Prerequisites

- `main` must contain `npm run check` and `.github/workflows/ci.yml`. Worker worktrees are created from `origin/main`, and the PR reviewer does not merge unless at least one CI check has succeeded.
- Add both `ready-for-agent` and `agent:implement` to issues handed to automated implementation, and include `## What to build` and `## Acceptance criteria` in the body (`## Out of scope` is optional). Record dependencies in GitHub Relationships `blockedBy`.
