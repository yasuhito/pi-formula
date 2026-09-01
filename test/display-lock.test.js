const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const { spawnSync } = require("node:child_process");

const checker = path.resolve(__dirname, "../scripts/check-display-lock");

function check({ sessionId, lockedHint, sessions = "" }) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "pi-formula-lock-"));
  const loginctl = path.join(directory, "loginctl");
  const log = path.join(directory, "loginctl.log");
  fs.writeFileSync(
    loginctl,
    `#!/usr/bin/env bash
printf '%s\\n' "$*" >>${JSON.stringify(log)}
if [[ "$1" == "list-sessions" ]]; then
  printf '%b\\n' ${JSON.stringify(sessions)}
  exit 0
fi
if [[ "$1" == "show-session" && "$*" == *"-p Type"* ]]; then
  if [[ "$2" == "1" ]]; then
    printf 'Type=unspecified\\nClass=manager\\nActive=yes\\n'
  else
    printf 'Type=wayland\\nClass=user\\nActive=yes\\n'
  fi
  exit 0
fi
if [[ "$1" == "show-session" && "$*" == *"-p LockedHint"* ]]; then
  printf 'LockedHint=%s\\n' ${JSON.stringify(lockedHint)}
  exit 0
fi
exit 1
`,
  );
  fs.chmodSync(loginctl, 0o755);
  const env = { ...process.env, PATH: `${directory}:${process.env.PATH}` };
  if (sessionId === undefined) delete env.XDG_SESSION_ID;
  else env.XDG_SESSION_ID = sessionId;
  const result = spawnSync(checker, [], { encoding: "utf8", env });
  const commands = fs.existsSync(log) ? fs.readFileSync(log, "utf8") : "";
  fs.rmSync(directory, { recursive: true, force: true });
  return { result, commands };
}

test("画面ロック中は理由を示して終了コード2で停止する", () => {
  const { result } = check({ sessionId: "7", lockedHint: "yes" });
  assert.deepEqual(
    { status: result.status, reportsLock: /画面がロック/u.test(result.stderr) },
    { status: 2, reportsLock: true },
  );
});

test("画面ロック解除中は検証を続行できる", () => {
  assert.equal(check({ sessionId: "7", lockedHint: "no" }).result.status, 0);
});

test("セッションIDが空なら現在の利用者のセッションを解決する", () => {
  const uid = process.getuid();
  const { result, commands } = check({
    sessionId: undefined,
    lockedHint: "no",
    sessions: [
      `1 ${uid} yasuhito - 1234 manager - no -`,
      `9 ${uid} yasuhito seat0 5678 user tty2 no -`,
    ].join("\n"),
  });
  assert.deepEqual(
    {
      status: result.status,
      listedSessions: commands.includes("list-sessions --no-legend --no-pager"),
      checkedSession: commands.includes("show-session 9 -p LockedHint"),
    },
    { status: 0, listedSessions: true, checkedSession: true },
  );
});

test("現在の利用者のセッションを解決できなければ安全に停止する", () => {
  const { result } = check({
    sessionId: undefined,
    lockedHint: "no",
    sessions: "9 999999 another seat0 1234 user tty2 no -",
  });
  assert.equal(result.status, 2);
});
