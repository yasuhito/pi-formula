const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const { spawn, spawnSync } = require("node:child_process");

const cleanup = path.resolve(__dirname, "../scripts/cleanup-display");
const stopper = path.resolve(__dirname, "../scripts/stop-display-process");
const windowVerifier = path.resolve(
  __dirname,
  "../scripts/verify-display-window",
);

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

test("dispatch が起動前に失敗しても headless 出力を削除する", () => {
  const directory = fs.mkdtempSync(
    path.join(os.tmpdir(), "pi-formula-cleanup-"),
  );
  const log = path.join(directory, "hyprctl.log");
  const fakeHyprctl = path.join(directory, "hyprctl");
  fs.writeFileSync(
    fakeHyprctl,
    `#!/usr/bin/env bash
if [[ "$1" == dispatch ]]; then exit 1; fi
if [[ "$1" == clients ]]; then printf '[]\\n'; exit 0; fi
printf '%s\\n' "$*" >>${JSON.stringify(log)}
`,
  );
  fs.chmodSync(fakeHyprctl, 0o755);

  const env = { ...process.env, PATH: `${directory}:${process.env.PATH}` };
  const dispatch = spawnSync(fakeHyprctl, ["dispatch", "launch"], {
    encoding: "utf8",
    env,
  });
  const result = spawnSync(cleanup, ["pf-test", "verify-window"], {
    encoding: "utf8",
    env,
  });

  assert.deepEqual(
    {
      dispatchStatus: dispatch.status,
      cleanupStatus: result.status,
      commands: fs.readFileSync(log, "utf8"),
    },
    {
      dispatchStatus: 1,
      cleanupStatus: 0,
      commands: "output remove pf-test\n",
    },
  );
  fs.rmSync(directory, { recursive: true, force: true });
});

test("キャプチャ前に検証ウィンドウが消えていたら拒否する", () => {
  const directory = fs.mkdtempSync(
    path.join(os.tmpdir(), "pi-formula-window-check-"),
  );
  const fakeHyprctl = path.join(directory, "hyprctl");
  fs.writeFileSync(fakeHyprctl, "#!/usr/bin/env bash\nprintf '[]\\n'\n");
  fs.chmodSync(fakeHyprctl, 0o755);

  const result = spawnSync(
    windowVerifier,
    ["verify-window", "42", "0xexpected"],
    {
      encoding: "utf8",
      env: { ...process.env, PATH: `${directory}:${process.env.PATH}` },
    },
  );

  assert.equal(result.status, 2);
  fs.rmSync(directory, { recursive: true, force: true });
});
