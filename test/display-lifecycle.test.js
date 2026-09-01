const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const { spawn, spawnSync } = require("node:child_process");

const stopper = path.resolve(__dirname, "../scripts/stop-display-process");

function sleep(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

test("close 失敗時も遅延起動の process group を止めてウィンドウ消滅を待つ", async () => {
  const directory = fs.mkdtempSync(
    path.join(os.tmpdir(), "pi-formula-lifecycle-"),
  );
  const marker = path.join(directory, "late-window");
  const fakeHyprctl = path.join(directory, "hyprctl");
  const child = spawn(
    "bash",
    ["-c", `sleep 1; touch ${JSON.stringify(marker)}; sleep 30`],
    {
      detached: true,
      stdio: "ignore",
    },
  );
  child.unref();
  fs.writeFileSync(
    fakeHyprctl,
    `#!/usr/bin/env bash
if [[ "$1" == dispatch ]]; then exit 1; fi
printf '[]\\n'
`,
  );
  fs.chmodSync(fakeHyprctl, 0o755);

  const result = spawnSync(stopper, [String(child.pid), "verify-window"], {
    encoding: "utf8",
    env: { ...process.env, PATH: `${directory}:${process.env.PATH}` },
  });
  await sleep(1_200);

  assert.deepEqual(
    { status: result.status, lateWindowExists: fs.existsSync(marker) },
    { status: 0, lateWindowExists: false },
  );
  fs.rmSync(directory, { recursive: true, force: true });
});
