# AGENTS.md

## Agent skills

### Issue tracker

課題と仕様は GitHub Issues で管理する。詳細は `docs/agents/issue-tracker.md` を参照する。

### Triage labels

標準の triage 役割は同名の GitHub label に対応させる。詳細は `docs/agents/triage-labels.md` を参照する。

### Domain docs

このリポジトリは single-context として扱い、ルートの `CONTEXT.md` と `docs/adr/` を使う。詳細は `docs/agents/domain.md` を参照する。

## 自動化ループ

- Orca automation `pi-formula issue coordinator` が `ready-for-agent` と `agent:implement` の両方を持つ issue を worker に渡し、PR を作る。
- Orca automation `pi-formula PR reviewer` が `agent:review` の PR をレビューし、ゲートを通過した場合だけマージする。
- 自動化に渡したくない issue には `agent:implement` を付けない。`agent:blocked` が付いた issue / PR は人間が原因を確認するまで自動処理されない。
- prompt と precheck の原本は `docs/agents/automations/` にある。
