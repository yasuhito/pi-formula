# Orca automation の定義

`pi-formula issue coordinator` と `pi-formula PR reviewer` は Orca の automation として登録されている。このディレクトリはその prompt と precheck の原本で、Orca 側を更新するときはここを編集してから反映する。設定は `yasuhito/clawbar` の同名 automation を元にしている。

| automation | id | prompt | precheck |
| --- | --- | --- | --- |
| pi-formula issue coordinator | `6eaaca9d-67be-4743-88a4-9e82e0659531` | `issue-coordinator.md` | `issue-coordinator.precheck.sh` |
| pi-formula PR reviewer | `4c2c4f81-0bdc-49a8-a52d-7237b9f4c002` | `pr-reviewer.md` | `pr-reviewer.precheck.sh` |

両方とも 10 分おき（`*/10 * * * *`、Asia/Tokyo）に、既存 workspace `/home/yasuhito/Work/pi-formula` で agent `pi` を起動する。precheck の終了コードが 0 のときだけ prompt が実行され、それ以外は skip として記録される。

## 反映

```bash
orca-ide automations edit <id> --prompt "$(cat docs/agents/automations/issue-coordinator.md)" --json
orca-ide automations edit <id> --precheck "$(cat docs/agents/automations/issue-coordinator.precheck.sh)" --precheck-timeout 60 --json
```

## 有効化と停止

```bash
orca-ide automations edit <id> --enabled --json
orca-ide automations edit <id> --disabled --json
orca-ide automations runs --id <id> --json
```

## 動かすための前提

- `main` に `npm run check` と `.github/workflows/ci.yml` が入っていること。worker worktree は `origin/main` から作られ、PR reviewer は CI checks が 1 件以上成功していないとマージしない。
- 自動実装に渡す issue には `ready-for-agent` と `agent:implement` の両方を付け、本文に `## What to build` と `## Acceptance criteria` を書く（`## Out of scope` は任意）。依存関係は GitHub Relationships の `blockedBy` に入れる。
- `.pi/extensions/pi-formula-orca-role-name.ts` が pi の session 名を役割ごとに付ける。
