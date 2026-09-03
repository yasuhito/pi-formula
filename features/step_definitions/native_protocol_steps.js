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

Given("vt-pty で文字を出力する子プロセスを起動する", function () {
  this.nativeCommand = ["--settle-ms", "20", "--", "printf", "hello"];
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
    "--",
    process.execPath,
    "-e",
    "setTimeout(() => {}, 1000)",
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

Then("環境変数で指定した vt-pty が実行される", function () {
  assert.deepEqual(
    { status: this.nativeResult.status, stdout: this.nativeResult.stdout },
    { status: 0, stdout: "selected vt-pty\n" },
    this.nativeResult.stderr,
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
        "zig build -Demit-lib-vt -Doptimize=ReleaseFast --prefix " +
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
      this.nativeResult.stderr.includes("vt-pty: timeout"),
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
