cd "${PI_FORMULA_REPO:-/home/yasuhito/Work/pi-formula}" && python3 - <<'PY'
import json
import subprocess
import sys
import time

AUTOMATION_IDS = (
    "6eaaca9d-67be-4743-88a4-9e82e0659531",
    "4c2c4f81-0bdc-49a8-a52d-7237b9f4c002",
)


# Orca marks a run completed a few seconds after dispatch, but the agent keeps working.
# Closing a tab based on status alone kills an active agent
# (on 2026-09-04, the terminal reviewing PR #98 was closed on the next tick just after writing its verdict).
# Active Pi keeps drawing its spinner, updating lastOutputAt.
# Close only tabs that have been quiet for longer than this window.
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


def gh_json(*args):
    return json.loads(subprocess.check_output(["gh", *args], text=True))

prs = gh_json(
    "pr", "list", "-R", repo, "--state", "open", "--label", "agent:review", "--limit", "100",
    "--json", "number,isDraft,labels,statusCheckRollup,reviewRequests"
)

def clear_stale_reviewing(prs):
    """A crashed run can leave agent:reviewing behind, causing every run to skip.
    Self-repair by removing agent:reviewing when it was applied at least 45 minutes ago
    (PR #20 deadlocked on 2026-08-31)."""
    import datetime
    now = datetime.datetime.now(datetime.timezone.utc)
    for pr in prs:
        if "agent:reviewing" not in {label["name"] for label in pr.get("labels", [])}:
            continue
        try:
            events = gh_json("api", f"repos/{repo}/issues/{pr['number']}/timeline", "--paginate")
        except subprocess.CalledProcessError:
            continue
        applied = None
        for event in events:
            if event.get("event") == "labeled" and (event.get("label") or {}).get("name") == "agent:reviewing":
                applied = event.get("created_at")
        if not applied:
            continue
        applied_at = datetime.datetime.fromisoformat(applied.replace("Z", "+00:00"))
        if (now - applied_at).total_seconds() < 45 * 60:
            continue
        subprocess.run(
            ["gh", "pr", "edit", str(pr["number"]), "-R", repo, "--remove-label", "agent:reviewing"],
            stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, check=False,
        )
        pr["labels"] = [label for label in pr.get("labels", []) if label["name"] != "agent:reviewing"]


clear_stale_reviewing(prs)

blocked_labels = {"agent:reviewing", "ready-for-human", "agent:blocked"}
# Run only one review at a time. Do not start a new run while another PR is under review (agent:reviewing exists).
if any("agent:reviewing" in {label["name"] for label in pr.get("labels", [])} for pr in prs):
    sys.exit(1)
for pr in prs:
    labels = {label["name"] for label in pr.get("labels", [])}
    if labels & blocked_labels:
        continue
    if pr.get("isDraft"):
        sys.exit(0)

    requests = pr.get("reviewRequests") or []
    copilot_requested = False
    for request in requests:
        login = (request.get("login") or (request.get("requestedReviewer") or {}).get("login") or "").lower()
        if "copilot" in login:
            copilot_requested = True
            break
    if copilot_requested:
        continue

    checks = pr.get("statusCheckRollup") or []
    check_pending = False
    for check in checks:
        status = (check.get("status") or check.get("state") or "").upper()
        if status in {"QUEUED", "IN_PROGRESS", "PENDING", "EXPECTED", "WAITING"}:
            check_pending = True
            break
    if check_pending:
        continue

    sys.exit(0)

sys.exit(1)
PY
