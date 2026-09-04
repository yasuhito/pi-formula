const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const { After, Before, Given, Then, When } = require("@cucumber/cucumber");
const { resolveVtTool } = require("../../scripts/vt-tool");

const root = path.resolve(__dirname, "../..");

Before({ tags: "@native-vt" }, function () {
  const tool = resolveVtTool();
  if (tool) {
    this.vtTool = tool;
    return undefined;
  }
  console.log("SKIP: libghostty-vt のプロトコル検査（vt-pty がありません）");
  return "skipped";
});

After(function () {
  if (this.nativeTestDirectory) {
    fs.rmSync(this.nativeTestDirectory, { recursive: true, force: true });
  }
});

Given("vt-pty がない環境がある", function () {
  this.nativeTestDirectory = fs.mkdtempSync(
    path.join(os.tmpdir(), "pi-formula-native-test-"),
  );
  this.nativeEnvironment = {
    ...process.env,
    PI_FORMULA_VT_TOOL: path.join(this.nativeTestDirectory, "missing-vt-pty"),
    XDG_CACHE_HOME: this.nativeTestDirectory,
  };
  this.entranceArguments = ["--", "printf", "hello"];
});

Given("環境変数で指定した vt-pty がある", function () {
  this.nativeTestDirectory = fs.mkdtempSync(
    path.join(os.tmpdir(), "pi-formula-native-test-"),
  );
  const selectedTool = path.join(this.nativeTestDirectory, "selected-vt-pty");
  fs.writeFileSync(selectedTool, "#!/bin/sh\nprintf 'selected vt-pty\\n'\n");
  fs.chmodSync(selectedTool, 0o755);
  this.nativeEnvironment = {
    ...process.env,
    PI_FORMULA_VT_TOOL: selectedTool,
  };
  this.entranceArguments = ["--", "printf", "hello"];
});

Given("ホーム側の native prefix を指定する", function () {
  fs.mkdirSync(path.join(os.homedir(), ".cache"), { recursive: true });
  this.nativeTestDirectory = fs.mkdtempSync(
    path.join(os.homedir(), ".cache/pi-formula-native-plan-"),
  );
});

Given("ビルド成果物がない検査用 checkout がある", function () {
  this.nativeTestDirectory = fs.mkdtempSync(
    path.join(os.tmpdir(), "pi-formula-encoder-checkout-"),
  );
  for (const file of ["package.json", "tsconfig.json"]) {
    fs.copyFileSync(
      path.join(root, file),
      path.join(this.nativeTestDirectory, file),
    );
  }
  for (const directory of ["src", "test/support"]) {
    fs.cpSync(
      path.join(root, directory),
      path.join(this.nativeTestDirectory, directory),
      { recursive: true },
    );
  }
  fs.mkdirSync(path.join(this.nativeTestDirectory, "scripts"));
  for (const file of [
    "clean-dist.js",
    "verify-encoder-protocol.js",
    "vt-tool.js",
  ]) {
    fs.copyFileSync(
      path.join(root, "scripts", file),
      path.join(this.nativeTestDirectory, "scripts", file),
    );
  }
  fs.mkdirSync(path.join(this.nativeTestDirectory, "native"));
  fs.copyFileSync(
    path.join(root, "native/libghostty-vt.commit"),
    path.join(this.nativeTestDirectory, "native/libghostty-vt.commit"),
  );
  fs.symlinkSync(
    path.join(root, "node_modules"),
    path.join(this.nativeTestDirectory, "node_modules"),
    "dir",
  );
});

Given("テキスト経路の利用者設定と tmux 端末環境がある", function () {
  const configHome = path.join(this.nativeTestDirectory, "user-config");
  const formulaConfig = path.join(configHome, "pi-formula");
  fs.mkdirSync(formulaConfig, { recursive: true });
  fs.writeFileSync(
    path.join(formulaConfig, "config.json"),
    JSON.stringify({ path: "text", macros: { usermacro: String.raw`\beta` } }),
  );
  this.encoderEnvironment = {
    ...process.env,
    PI_FORMULA_VT_TOOL: this.vtTool,
    PI_FORMULA_MACROS: JSON.stringify({ environmentmacro: String.raw`\gamma` }),
    TERM: "tmux-256color",
    TMUX: "1",
    XDG_CONFIG_HOME: configHome,
  };
});

Given("vt-pty で文字を出力する子プロセスを起動する", function () {
  this.nativeCommand = ["--settle-ms", "20", "--", "printf", "hello"];
});

Given(
  "vt-pty の収束時間より遅れて仮想配置を出力する子プロセスがある",
  function () {
    const program = `
const png = Buffer.alloc(24);
png.set([137, 80, 78, 71]);
png.writeUInt32BE(1, 16);
png.writeUInt32BE(1, 20);
process.stdout.write("start");
setTimeout(() => {
  process.stdout.write(
    "\\x1b_Ga=T,f=100,q=2,U=1,i=1,p=1,c=1,r=1;" +
      png.toString("base64") +
      "\\x1b\\\\",
  );
}, 350);
`;
    this.nativeCommand = [
      "--settle-ms",
      "20",
      "--wait-for-placements",
      "1",
      "--",
      process.execPath,
      "-e",
      program,
    ];
  },
);

function placementFollowedByContinuousOutput(
  waitForPlacements,
  tail = "",
  padding = 0,
) {
  const timeout = padding > 0 ? 2000 : 300;
  const program = `
const png = Buffer.alloc(24);
png.set([137, 80, 78, 71]);
png.writeUInt32BE(1, 16);
png.writeUInt32BE(1, 20);
const placement = Buffer.from(
  "\\x1b[?2026h\\x1b_Ga=T,f=100,q=2,U=1,i=1,p=1,c=1,r=1;" +
    png.toString("base64") +
    "\\x1b\\\\",
);
process.stdout.write(Buffer.concat([placement, Buffer.alloc(${padding})]), () => {
  process.stdout.write(${JSON.stringify(`${tail}\x1b[?2026l`)});
  setInterval(() => process.stdout.write("."), 5);
});
`;
  return [
    "--settle-ms",
    String(timeout + 1000),
    "--timeout-ms",
    String(timeout),
    "--wait-for-placements",
    String(waitForPlacements),
    "--wait-for-render-boundary",
    "--",
    process.execPath,
    "-e",
    program,
  ];
}

Given("必要な仮想配置の後も出力を続ける子プロセスがある", function () {
  this.nativeCommand = placementFollowedByContinuousOutput(1);
});

Given(
  "仮想配置の後に placeholder と本文を分けて出力し続ける子プロセスがある",
  function () {
    const placeholder =
      "\x1b[38;2;0;0;1m\x1b[58:2::0:0:1m" +
      `${String.fromCodePoint(0x10eeee)}\u0305\u0305` +
      "\x1b[39;59mafter-placement";
    this.nativeCommand = placementFollowedByContinuousOutput(
      1,
      placeholder,
      65536,
    );
  },
);

Given("一部の仮想配置を出した後も出力を続ける子プロセスがある", function () {
  this.nativeCommand = placementFollowedByContinuousOutput(2);
});

Given("vt-pty で16 codepointを超える grapheme cluster を出力する", function () {
  this.nativeCommand = [
    "--settle-ms",
    "20",
    "--",
    process.execPath,
    "-e",
    'process.stdout.write("a" + "\\u0301".repeat(32))',
  ];
});

Given("vt-pty の期限を超えて動く子プロセスがある", function () {
  this.nativeEnvironment = {
    ...process.env,
    PI_FORMULA_VT_TOOL: this.vtTool,
  };
  this.entranceArguments = [
    "--timeout-ms",
    "20",
    "--wait-for-placements",
    "1",
    "--",
    process.execPath,
    "-e",
    'process.stdout.write("start"); setTimeout(() => {}, 1000)',
  ];
});

Given("vt-pty から起動できない子プロセスがある", function () {
  this.nativeEnvironment = {
    ...process.env,
    PI_FORMULA_VT_TOOL: this.vtTool,
  };
  this.entranceArguments = ["--", "pi-formula-command-that-does-not-exist"];
});

Given("本文セルに APC の断片を返す vt-pty がある", function () {
  this.nativeTestDirectory = fs.mkdtempSync(
    path.join(os.tmpdir(), "pi-formula-apc-test-"),
  );
  const tool = path.join(this.nativeTestDirectory, "apc-vt-pty");
  const placements = Array.from(
    { length: 7 },
    (_, index) =>
      `placement: image_id=${index} virtual=1 image={1x1 format=100 bytes=4}`,
  ).join("\\n");
  fs.writeFileSync(
    tool,
    `#!/bin/sh\nprintf '%s\\n' '${placements}' 'kitty.placements=7' 'cells.dirty_placeholders=0 cells.apc_leak=1'\n`,
  );
  fs.chmodSync(tool, 0o755);
  this.nativeEnvironment = { ...process.env, PI_FORMULA_VT_TOOL: tool };
});

Given("placeholder のない仮想配置を返す vt-pty がある", function () {
  this.nativeTestDirectory = fs.mkdtempSync(
    path.join(os.tmpdir(), "pi-formula-missing-placeholder-test-"),
  );
  const tool = path.join(
    this.nativeTestDirectory,
    "missing-placeholder-vt-pty",
  );
  const placements = Array.from(
    { length: 7 },
    (_, index) =>
      `placement: image_id=0x${String(index + 1).padStart(6, "0")} placement_id=0x000001 virtual=1 cols=1 rows=1 z=0 image={1x1 format=1 bytes=4}`,
  ).join("\n");
  fs.writeFileSync(
    tool,
    `#!/bin/sh\nprintf '%s\n' '${placements}' 'kitty.placements=7' 'cells.placeholders=0 cells.underline_not_rgb=0 cells.dirty_placeholders=0 cells.apc_leak=0'\n`,
  );
  fs.chmodSync(tool, 0o755);
  this.nativeEnvironment = { ...process.env, PI_FORMULA_VT_TOOL: tool };
});

Given("描画が落ち着かない vt-pty がある", function () {
  this.nativeTestDirectory = fs.mkdtempSync(
    path.join(os.tmpdir(), "pi-formula-unsettled-test-"),
  );
  const tool = path.join(this.nativeTestDirectory, "unsettled-vt-pty");
  fs.writeFileSync(
    tool,
    "#!/bin/sh\nprintf 'vt-pty: timeout 15000ms\\n' >&2\nexit 2\n",
  );
  fs.chmodSync(tool, 0o755);
  this.nativeEnvironment = { ...process.env, PI_FORMULA_VT_TOOL: tool };
});

Given("保存済みコーパスセッションを Pi で開く", function () {
  this.nativeEnvironment = {
    ...process.env,
    PI_FORMULA_VT_TOOL: this.vtTool,
  };
});

Given("Pi の未完了本文と確定本文を順に描く検査がある", function () {
  this.nativeEnvironment = {
    ...process.env,
    PI_FORMULA_VT_TOOL: this.vtTool,
  };
});

Given("下線色をセミコロン形式へ戻した pi-formula がある", function () {
  this.nativeTestDirectory = fs.mkdtempSync(
    path.join(root, ".pi-formula-dirty-placeholder-test-"),
  );
  const source = path.join(this.nativeTestDirectory, "src");
  fs.cpSync(path.join(root, "src"), source, { recursive: true });
  fs.copyFileSync(
    path.join(root, "package.json"),
    path.join(this.nativeTestDirectory, "package.json"),
  );
  const kittyPath = path.join(source, "kitty.ts");
  const kitty = fs.readFileSync(kittyPath, "utf8");
  fs.writeFileSync(
    kittyPath,
    kitty.replace(/\[58:2::\$\{red\}:\$\{green\}:\$\{blue\}m/u, (value) =>
      value.replace(":2::", ";2;").replaceAll(":", ";"),
    ),
  );
  this.nativeEnvironment = {
    ...process.env,
    PI_FORMULA_VT_TOOL: this.vtTool,
    PI_FORMULA_PROTOCOL_EXTENSION: path.join(source, "extension.ts"),
  };
});

When("プロトコル検査の入口を実行する", function () {
  this.nativeResult = spawnSync(
    process.execPath,
    ["scripts/run-vt-pty.js", ...this.entranceArguments],
    {
      cwd: root,
      encoding: "utf8",
      env: this.nativeEnvironment,
      timeout: 10_000,
    },
  );
});

When("libghostty-vt のビルド計画を出力する", function () {
  this.nativeResult = spawnSync(
    "scripts/build-vt-pty",
    ["--prefix", this.nativeTestDirectory, "--print-plan"],
    { cwd: root, encoding: "utf8", timeout: 10_000 },
  );
  this.buildPlan = Object.fromEntries(
    this.nativeResult.stdout
      .trim()
      .split("\n")
      .map((line) => {
        const separator = line.indexOf("=");
        return [line.slice(0, separator), line.slice(separator + 1)];
      }),
  );
});

function inspectEncoderProtocol(world, check, environment = process.env) {
  world.nativeResult = spawnSync(
    process.execPath,
    ["scripts/verify-encoder-protocol.js", "--check", check],
    {
      cwd: root,
      encoding: "utf8",
      env: { ...environment, PI_FORMULA_VT_TOOL: world.vtTool },
      timeout: 30_000,
    },
  );
}

When("エンコーダ層のプロトコル検査を実行する", function () {
  inspectEncoderProtocol(this, "storage", this.nativeEnvironment);
});

When("エンコーダ層の storage を検査する", function () {
  inspectEncoderProtocol(this, "storage");
});

When("文書化されたエンコーダ層の検査入口を実行する", function () {
  this.nativeResult = spawnSync(
    "npm",
    ["run", "verify:encoder-protocol", "--", "--check", "storage"],
    {
      cwd: this.nativeTestDirectory,
      encoding: "utf8",
      env: this.encoderEnvironment ?? {
        ...process.env,
        PI_FORMULA_VT_TOOL: this.vtTool,
      },
      timeout: 30_000,
    },
  );
});

When("エンコーダ層の仮想配置を検査する", function () {
  inspectEncoderProtocol(this, "placement");
});

When("エンコーダ層の placeholder の画像 ID を検査する", function () {
  inspectEncoderProtocol(this, "image-id");
});

When("エンコーダ層の placeholder の座標を検査する", function () {
  inspectEncoderProtocol(this, "coordinates");
});

When("エンコーダ層の placeholder の下線色タグを検査する", function () {
  inspectEncoderProtocol(this, "underline");
});

When("同じ Markdown の二回目のエンコーダ出力を検査する", function () {
  inspectEncoderProtocol(this, "cached");
});

When("画像転送を省いたエンコーダ出力を検査する", function () {
  inspectEncoderProtocol(this, "missing-transfer");
});

When("子プロセスの出力が落ち着くまで待つ", function () {
  this.nativeResult = spawnSync(this.vtTool, this.nativeCommand, {
    cwd: root,
    encoding: "utf8",
    timeout: 10_000,
  });
});

When("Pi を通したプロトコル検査を実行する", function () {
  this.nativeResult = spawnSync(
    process.execPath,
    ["scripts/verify-pi-protocol.js"],
    {
      cwd: root,
      encoding: "utf8",
      env: this.nativeEnvironment,
      timeout: 30_000,
    },
  );
});

When("ストリーミング中のプロトコル検査を実行する", function () {
  this.nativeResult = spawnSync(
    process.execPath,
    ["scripts/verify-streaming-protocol.js"],
    {
      cwd: root,
      encoding: "utf8",
      env: this.nativeEnvironment,
      timeout: 30_000,
    },
  );
});

Then("成功として skip したことが出力される", function () {
  assert.deepEqual(
    { status: this.nativeResult.status, stdout: this.nativeResult.stdout },
    {
      status: 0,
      stdout: "SKIP: libghostty-vt のプロトコル検査（vt-pty がありません）\n",
    },
    this.nativeResult.stderr,
  );
});

Then("Pi を通した検査を成功として skip したことが出力される", function () {
  assert.deepEqual(
    { status: this.nativeResult.status, stdout: this.nativeResult.stdout },
    {
      status: 0,
      stdout: "SKIP: Pi を通したプロトコル検査（vt-pty がありません）\n",
    },
    this.nativeResult.stderr,
  );
});

Then(
  "ストリーミング中の検査を成功として skip したことが出力される",
  function () {
    assert.deepEqual(
      { status: this.nativeResult.status, stdout: this.nativeResult.stdout },
      {
        status: 0,
        stdout:
          "SKIP: ストリーミング中のプロトコル検査（vt-pty がありません）\n",
      },
      this.nativeResult.stderr,
    );
  },
);

Then("複数のフレームが時系列で検査されたと報告される", function () {
  assert.equal(
    this.nativeResult.status === 0 &&
      /streaming-protocol: frames=([2-9]|[1-9][0-9]+)/u.test(
        this.nativeResult.stdout,
      ),
    true,
    this.nativeResult.stderr || this.nativeResult.stdout,
  );
});

Then("途中のどのフレームにも APC の断片がないと報告される", function () {
  assert.equal(
    this.nativeResult.status === 0 &&
      this.nativeResult.stdout.includes("streaming-protocol: apc_leak=0"),
    true,
    this.nativeResult.stderr || this.nativeResult.stdout,
  );
});

Then("最終フレームの表示数式と仮想配置の数が一致する", function () {
  assert.equal(
    this.nativeResult.status === 0 &&
      /streaming-protocol: final display_formulas=(\d+) virtual_images=\1/u.test(
        this.nativeResult.stdout,
      ),
    true,
    this.nativeResult.stderr || this.nativeResult.stdout,
  );
});

Then("環境変数で指定した vt-pty が実行される", function () {
  assert.deepEqual(
    { status: this.nativeResult.status, stdout: this.nativeResult.stdout },
    { status: 0, stdout: "selected vt-pty\n" },
    this.nativeResult.stderr,
  );
});

Then("エンコーダ層の検査を成功として skip したことが出力される", function () {
  assert.deepEqual(
    { status: this.nativeResult.status, stdout: this.nativeResult.stdout },
    {
      status: 0,
      stdout: "SKIP: エンコーダ層のプロトコル検査（vt-pty がありません）\n",
    },
    this.nativeResult.stderr,
  );
});

function assertEncoderCheck(world, message) {
  assert.deepEqual(
    { status: world.nativeResult.status, stdout: world.nativeResult.stdout },
    { status: 0, stdout: `${message}\n` },
    world.nativeResult.stderr,
  );
}

Then("storage に計画どおりの PNG 画像が一件ある", function () {
  assertEncoderCheck(this, "encoder-protocol: storage ok");
});

Then(
  "利用者設定を使わず現在のエンコーダをビルドしてプロトコル状態を検査する",
  function () {
    assert.equal(
      this.nativeResult.status === 0 &&
        this.nativeResult.stdout.includes("encoder-protocol: storage ok") &&
        fs.existsSync(path.join(this.nativeTestDirectory, "dist/extension.js")),
      true,
      this.nativeResult.stderr || this.nativeResult.stdout,
    );
  },
);

Then("仮想配置の列数と行数が計画と一致する", function () {
  assertEncoderCheck(this, "encoder-protocol: placement ok");
});

Then("foreground RGB から復元した画像 ID が計画と一致する", function () {
  assertEncoderCheck(this, "encoder-protocol: image-id ok");
});

Then("diacritics から復元した座標が欠けも余りもなく並ぶ", function () {
  assertEncoderCheck(this, "encoder-protocol: coordinates ok");
});

Then("すべての placeholder セルの下線色タグが RGB である", function () {
  assertEncoderCheck(this, "encoder-protocol: underline ok");
});

Then("二回目も storage に画像がある", function () {
  assertEncoderCheck(this, "encoder-protocol: cached ok");
});

Then("placeholder が指す画像 ID に仮想配置がないと報告される", function () {
  assert.deepEqual(
    {
      status: this.nativeResult.status,
      problem: this.nativeResult.stderr.trim(),
    },
    {
      status: 1,
      problem: "placeholder が指す id に仮想配置がない",
    },
    this.nativeResult.stdout,
  );
});

Then("pin と指定 prefix だけを使うビルド計画が得られる", function () {
  assert.deepEqual(
    {
      status: this.nativeResult.status,
      pin: this.buildPlan.pin,
      prefix: this.buildPlan.prefix,
      include: this.buildPlan.include,
      library: this.buildPlan.library,
      vtTool: this.buildPlan["vt-tool"],
      zigCommand: this.buildPlan["zig-command"],
    },
    {
      status: 0,
      pin: "349f026087d948f8f898dca3231ff91438f83ab8",
      prefix: this.nativeTestDirectory,
      include: path.join(this.nativeTestDirectory, "include"),
      library: path.join(this.nativeTestDirectory, "lib"),
      vtTool: path.join(this.nativeTestDirectory, "bin/vt-pty"),
      zigCommand:
        "zig build -Demit-lib-vt -Doptimize=ReleaseFast -Dcpu=baseline --prefix " +
        this.nativeTestDirectory,
    },
    this.nativeResult.stderr,
  );
});

Then("libghostty-vt が解析したプロトコル状態が出力される", function () {
  assert.equal(
    this.nativeResult.status === 0 &&
      this.nativeResult.stdout.includes('row[0]: placeholders=0 "hello"') &&
      this.nativeResult.stdout.includes("kitty.placements=0") &&
      this.nativeResult.stdout.includes("cells.apc_leak=0"),
    true,
    this.nativeResult.stderr || this.nativeResult.stdout,
  );
});

Then("必要な仮想配置を受け取ってからプロトコル状態が出力される", function () {
  assert.equal(
    this.nativeResult.status === 0 &&
      this.nativeResult.stdout.includes("kitty.placements=1"),
    true,
    this.nativeResult.stderr || this.nativeResult.stdout,
  );
});

Then("出力の静止を待たずにプロトコル状態が出力される", function () {
  assert.equal(
    this.nativeResult.status === 0 &&
      this.nativeResult.stdout.includes("kitty.placements=1"),
    true,
    this.nativeResult.stderr || this.nativeResult.stdout,
  );
});

Then(
  "仮想配置に続く placeholder と本文のプロトコル状態が出力される",
  function () {
    assert.equal(
      this.nativeResult.status === 0 &&
        this.nativeResult.stdout.includes(
          "placeholder: image_id=0x000001 row=0 col=0",
        ) &&
        this.nativeResult.stdout.includes("after-placement"),
      true,
      this.nativeResult.stderr || this.nativeResult.stdout,
    );
  },
);

Then("timeout 時点の仮想配置数が出力される", function () {
  assert.equal(
    this.nativeResult.status !== 0 &&
      this.nativeResult.stderr.includes(
        "waiting for 2 placements (observed 1)",
      ),
    true,
    this.nativeResult.stderr || this.nativeResult.stdout,
  );
});

Then("長い grapheme cluster のプロトコル状態が出力される", function () {
  assert.equal(
    this.nativeResult.status === 0 &&
      this.nativeResult.stdout.includes('row[0]: placeholders=0 "a"') &&
      this.nativeResult.stdout.includes("cells.apc_leak=0"),
    true,
    this.nativeResult.stderr || this.nativeResult.stdout,
  );
});

Then("timeout は成功として扱われない", function () {
  assert.equal(
    this.nativeResult.status !== 0 &&
      this.nativeResult.stderr.includes(
        "waiting for 1 placements (observed 0)",
      ),
    true,
    this.nativeResult.stderr || this.nativeResult.stdout,
  );
});

Then("子プロセスの起動失敗は成功として扱われない", function () {
  assert.equal(
    this.nativeResult.status !== 0 &&
      this.nativeResult.stderr.includes("child exited with status 127"),
    true,
    this.nativeResult.stderr || this.nativeResult.stdout,
  );
});

Then("本文セルの APC 断片を検出して失敗する", function () {
  assert.equal(
    this.nativeResult.status === 1 &&
      /Pi を通した本文セルに APC の断片/u.test(this.nativeResult.stderr),
    true,
    this.nativeResult.stderr || this.nativeResult.stdout,
  );
});

Then("仮想配置に対応する placeholder の欠落を検出して失敗する", function () {
  assert.equal(
    this.nativeResult.status === 1 &&
      this.nativeResult.stderr.includes(
        "仮想配置に対応する placeholder がありません",
      ),
    true,
    this.nativeResult.stderr || this.nativeResult.stdout,
  );
});

Then("描画が落ち着かない理由が出力される", function () {
  assert.deepEqual(
    {
      status: this.nativeResult.status,
      reason: this.nativeResult.stderr.trim(),
    },
    { status: 2, reason: "vt-pty: timeout 15000ms" },
    this.nativeResult.stdout,
  );
});

Then("placeholder セルの汚れがないと報告される", function () {
  assert.equal(
    this.nativeResult.status === 0 &&
      this.nativeResult.stdout.includes("cells.dirty_placeholders=0"),
    true,
    this.nativeResult.stderr || this.nativeResult.stdout,
  );
});

Then("本文セルに APC の断片がないと報告される", function () {
  assert.equal(
    this.nativeResult.status === 0 &&
      this.nativeResult.stdout.includes("cells.apc_leak=0"),
    true,
    this.nativeResult.stderr || this.nativeResult.stdout,
  );
});

Then("表示数式と storage 付き仮想配置の数が一致する", function () {
  assert.equal(
    this.nativeResult.status === 0 &&
      /pi-protocol: display_formulas=(\d+) virtual_images=\1/u.test(
        this.nativeResult.stdout,
      ),
    true,
    this.nativeResult.stderr || this.nativeResult.stdout,
  );
});

Then("placeholder セルの汚れを検出して失敗する", function () {
  assert.equal(
    this.nativeResult.status === 1 &&
      /Pi を通した placeholder セルに汚れ/u.test(this.nativeResult.stderr),
    true,
    this.nativeResult.stderr || this.nativeResult.stdout,
  );
});
