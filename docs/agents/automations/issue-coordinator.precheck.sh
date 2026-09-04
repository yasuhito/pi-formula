cd /home/yasuhito/Work/pi-formula && python3 - <<'PY'
import json
import re
import subprocess
import sys
import time

AUTOMATION_IDS = (
    "6eaaca9d-67be-4743-88a4-9e82e0659531",
    "4c2c4f81-0bdc-49a8-a52d-7237b9f4c002",
)


# Orca は dispatch の数秒後に run を completed にするが、agent はその後も動き続ける。
# status だけで tab を閉じると、働いている agent を殺してしまう
# （2026-09-04 に PR #98 のレビューで、判定を書いた直後の terminal が次の tick に閉じられた）。
# 動作中の Pi はスピナーを描き続けるため lastOutputAt が更新される。
# 静かになってからこの窓を過ぎた tab だけを閉じる。
QUIET_WINDOW_MS = 120_000


def terminal_is_busy(terminal):
    last_output_at = terminal.get("lastOutputAt")
    if not last_output_at:
        return False
    return (time.time() * 1000) - last_output_at < QUIET_WINDOW_MS


def cleanup_finished_automation_tabs():
    try:
        terminals_payload = json.loads(
            subprocess.check_output(["orca-ide", "terminal", "list", "--json"], text=True)
        )
        terminals = (terminals_payload.get("result") or {}).get("terminals") or []
        finished_tab_ids = set()
        for automation_id in AUTOMATION_IDS:
            runs_payload = json.loads(
                subprocess.check_output(
                    ["orca-ide", "automations", "runs", "--id", automation_id, "--json"],
                    text=True,
                )
            )
            for run in (runs_payload.get("result") or {}).get("runs") or []:
                if run.get("status") not in {"completed", "failed", "cancelled", "timed_out"}:
                    continue
                tab_id = run.get("terminalSessionId")
                if tab_id:
                    finished_tab_ids.add(tab_id)
    except (OSError, subprocess.CalledProcessError, json.JSONDecodeError):
        return

    for terminal in terminals:
        if terminal.get("tabId") not in finished_tab_ids:
            continue
        if terminal_is_busy(terminal):
            continue
        handle = terminal.get("handle")
        if not handle:
            continue
        subprocess.run(
            ["orca-ide", "terminal", "close", "--terminal", handle, "--tab", "--json"],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            check=False,
        )


cleanup_finished_automation_tabs()

repo = "yasuhito/pi-formula"
owner = "yasuhito"
name = "pi-formula"


def gh_json(*args):
    return json.loads(subprocess.check_output(["gh", *args], text=True))


def issue_blocked_by_numbers(number):
    data = gh_json(
        "api", "graphql",
        "-f", f"owner={owner}",
        "-f", f"name={name}",
        "-F", f"number={number}",
        "-f", "query=query($owner:String!, $name:String!, $number:Int!) { repository(owner:$owner, name:$name) { issue(number:$number) { blockedBy(first:20) { nodes { number } } } } }",
    )
    nodes = (((data.get("data") or {}).get("repository") or {}).get("issue") or {}).get("blockedBy", {}).get("nodes", [])
    return [int(node["number"]) for node in nodes if node.get("number") is not None]


def has_worker_worktree(branch):
    if not branch:
        return False
    result = subprocess.run(
        ["orca-ide", "worktree", "show", "--worktree", f"branch:{branch}", "--json"],
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )
    return result.returncode == 0

issues = gh_json("issue", "list", "-R", repo, "--state", "open", "--limit", "200", "--json", "number,title,body,labels,updatedAt")

skip_labels = {"agent:in-progress", "agent:blocked", "agent:waiting-dependency", "needs-info", "ready-for-human", "wontfix"}
# 同時実行は 1 件だけ。worker が動いている（agent:in-progress がある）間は新しい候補で run を起こさない。
worker_running = any(
    "agent:in-progress" in {label["name"] for label in issue.get("labels", [])} for issue in issues
)
for issue in issues:
    labels = {label["name"] for label in issue.get("labels", [])}
    if {"ready-for-agent", "agent:implement"} <= labels and not (labels & skip_labels) and not worker_running:
        sys.exit(0)

dependency_pattern = re.compile(r"(?:Depends on|Blocked by|依存:|ブロック:)\s*#(\d+)")
blocked_by_section_pattern = re.compile(r"^##\s*Blocked by\s*$\n((?:\s*-\s*#\d+\s*\n?)+)", re.MULTILINE)


def body_dependencies(body):
    dependencies = set(int(value) for value in dependency_pattern.findall(body))
    for section in blocked_by_section_pattern.findall(body):
        dependencies.update(int(value) for value in re.findall(r"#(\d+)", section))
    return dependencies
for issue in issues:
    labels = {label["name"] for label in issue.get("labels", [])}
    if "agent:waiting-dependency" not in labels:
        continue
    dependencies = body_dependencies(issue.get("body") or "")
    dependencies.update(issue_blocked_by_numbers(issue["number"]))
    if not dependencies:
        continue
    states = []
    for dependency in sorted(dependencies):
        data = gh_json("issue", "view", str(dependency), "-R", repo, "--json", "state")
        states.append((data.get("state") or "OPEN").upper())
    if states and all(state == "CLOSED" for state in states):
        sys.exit(0)

cleanup_labels = {"agent:review", "ready-for-human"}
seen = set()
for state in ("merged", "closed"):
    try:
        prs = gh_json("pr", "list", "-R", repo, "--state", state, "--limit", "100", "--json", "number,headRefName,labels")
    except subprocess.CalledProcessError:
        prs = []
    for pr in prs:
        number = pr.get("number")
        if number in seen:
            continue
        seen.add(number)
        labels = {label["name"] for label in pr.get("labels", [])}
        branch = pr.get("headRefName") or ""
        if not ((labels & cleanup_labels) or branch.startswith("yasuhito/agent-issue-")):
            continue
        if has_worker_worktree(branch):
            sys.exit(0)

sys.exit(1)
PY
