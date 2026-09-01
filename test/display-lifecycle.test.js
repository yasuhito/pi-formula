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
const compositorTest = {
  skip:
    process.platform === "linux"
      ? false
      : "HyprlandのライフサイクルスクリプトはLinux専用",
};

function sleep(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function writeFakeTimeout(directory) {
  const filename = path.join(directory, "timeout");
  fs.writeFileSync(
    filename,
    `#!/usr/bin/env bash
while [[ "$1" == --* ]]; do shift; done
shift
exec "$@"
`,
  );
  fs.chmodSync(filename, 0o755);
}

test(
  "close 失敗時も遅延起動の process group を止めてウィンドウ消滅を待つ",
  compositorTest,
  async () => {
    const directory = fs.mkdtempSync(
      path.join(os.tmpdir(), "pi-formula-lifecycle-"),
    );
    writeFakeTimeout(directory);
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
  },
);

test("ウィンドウ照会失敗を消滅確認の成功として扱わない", compositorTest, () => {
  const directory = fs.mkdtempSync(
    path.join(os.tmpdir(), "pi-formula-stop-query-"),
  );
  writeFakeTimeout(directory);
  const fakeHyprctl = path.join(directory, "hyprctl");
  fs.writeFileSync(
    fakeHyprctl,
    `#!/usr/bin/env bash
if [[ "$1" == clients ]]; then exit 1; fi
exit 0
`,
  );
  fs.chmodSync(fakeHyprctl, 0o755);

  const result = spawnSync(stopper, ["999999", "verify-window"], {
    encoding: "utf8",
    env: { ...process.env, PATH: `${directory}:${process.env.PATH}` },
  });

  assert.equal(result.status, 2);
  fs.rmSync(directory, { recursive: true, force: true });
});

test(
  "dispatch が起動前に失敗しても headless 出力を削除する",
  compositorTest,
  () => {
    const directory = fs.mkdtempSync(
      path.join(os.tmpdir(), "pi-formula-cleanup-"),
    );
    writeFakeTimeout(directory);
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
  },
);

test(
  "出力作成が副作用後に失敗しても headless 出力を削除する",
  compositorTest,
  () => {
    const directory = fs.mkdtempSync(
      path.join(os.tmpdir(), "pi-formula-create-cleanup-"),
    );
    writeFakeTimeout(directory);
    const log = path.join(directory, "hyprctl.log");
    const fakeHyprctl = path.join(directory, "hyprctl");
    fs.writeFileSync(
      fakeHyprctl,
      `#!/usr/bin/env bash
if [[ "$1 $2" == "output create" ]]; then
  printf '%s\\n' "$*" >>${JSON.stringify(log)}
  exit 1
fi
if [[ "$1" == clients ]]; then printf '[]\\n'; exit 0; fi
printf '%s\\n' "$*" >>${JSON.stringify(log)}
`,
    );
    fs.chmodSync(fakeHyprctl, 0o755);
    const env = { ...process.env, PATH: `${directory}:${process.env.PATH}` };
    const create = spawnSync(
      fakeHyprctl,
      ["output", "create", "headless", "pf-test"],
      {
        encoding: "utf8",
        env,
      },
    );
    const result = spawnSync(cleanup, ["pf-test", "verify-window"], {
      encoding: "utf8",
      env,
    });

    assert.deepEqual(
      {
        createStatus: create.status,
        cleanupStatus: result.status,
        commands: fs.readFileSync(log, "utf8"),
      },
      {
        createStatus: 1,
        cleanupStatus: 0,
        commands: "output create headless pf-test\noutput remove pf-test\n",
      },
    );
    fs.rmSync(directory, { recursive: true, force: true });
  },
);

test(
  "ウィンドウ照会に失敗しても出力削除へ進み終了コード2を返す",
  compositorTest,
  () => {
    const directory = fs.mkdtempSync(
      path.join(os.tmpdir(), "pi-formula-query-cleanup-"),
    );
    writeFakeTimeout(directory);
    const log = path.join(directory, "hyprctl.log");
    const fakeHyprctl = path.join(directory, "hyprctl");
    fs.writeFileSync(
      fakeHyprctl,
      `#!/usr/bin/env bash
if [[ "$1" == clients ]]; then exit 1; fi
printf '%s\\n' "$*" >>${JSON.stringify(log)}
`,
    );
    fs.chmodSync(fakeHyprctl, 0o755);

    const result = spawnSync(cleanup, ["pf-test", "verify-window"], {
      encoding: "utf8",
      env: { ...process.env, PATH: `${directory}:${process.env.PATH}` },
    });

    assert.deepEqual(
      {
        status: result.status,
        removedOutput: fs
          .readFileSync(log, "utf8")
          .includes("output remove pf-test"),
      },
      { status: 2, removedOutput: true },
    );
    fs.rmSync(directory, { recursive: true, force: true });
  },
);

test("検証ウィンドウ矩形をキャプチャ領域として返す", compositorTest, () => {
  const directory = fs.mkdtempSync(
    path.join(os.tmpdir(), "pi-formula-window-geometry-"),
  );
  writeFakeTimeout(directory);
  const fakeHyprctl = path.join(directory, "hyprctl");
  fs.writeFileSync(
    fakeHyprctl,
    `#!/usr/bin/env bash
printf '[{"title":"verify-window","monitor":42,"address":"0xexpected","at":[3014,40],"size":[1892,7946]}]\\n'
`,
  );
  fs.chmodSync(fakeHyprctl, 0o755);

  const result = spawnSync(
    windowVerifier,
    ["verify-window", "42", "0xexpected", "1920", "8000"],
    {
      encoding: "utf8",
      env: { ...process.env, PATH: `${directory}:${process.env.PATH}` },
    },
  );

  assert.deepEqual(
    { status: result.status, geometry: result.stdout.trim() },
    { status: 0, geometry: "3014,40 1892x7946" },
  );
  fs.rmSync(directory, { recursive: true, force: true });
});

test("headless 出力より小さい検証ウィンドウを拒否する", compositorTest, () => {
  const directory = fs.mkdtempSync(
    path.join(os.tmpdir(), "pi-formula-window-small-"),
  );
  writeFakeTimeout(directory);
  const fakeHyprctl = path.join(directory, "hyprctl");
  fs.writeFileSync(
    fakeHyprctl,
    `#!/usr/bin/env bash
printf '[{"title":"verify-window","monitor":42,"address":"0xexpected","at":[3000,20],"size":[800,600]}]\\n'
`,
  );
  fs.chmodSync(fakeHyprctl, 0o755);

  const result = spawnSync(
    windowVerifier,
    ["verify-window", "42", "0xexpected", "1920", "8000"],
    {
      encoding: "utf8",
      env: { ...process.env, PATH: `${directory}:${process.env.PATH}` },
    },
  );

  assert.equal(result.status, 2);
  fs.rmSync(directory, { recursive: true, force: true });
});

test(
  "キャプチャ前に検証ウィンドウが消えていたら拒否する",
  compositorTest,
  () => {
    const directory = fs.mkdtempSync(
      path.join(os.tmpdir(), "pi-formula-window-check-"),
    );
    writeFakeTimeout(directory);
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
  },
);
