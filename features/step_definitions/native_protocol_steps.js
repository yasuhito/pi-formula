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

Given("ホーム側のnative prefix設定がある", function () {
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

Given("vt-ptyで文字を出力する子プロセスの命令がある", function () {
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

Given(
  "vt-ptyで長いgrapheme clusterを出力する子プロセスの命令がある",
  function () {
    this.nativeCommand = [
      "--settle-ms",
      "20",
      "--",
      process.execPath,
      "-e",
      'process.stdout.write("a" + "\\u0301".repeat(32))',
    ];
  },
);

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

Given("Piで開く保存済みコーパスセッションがある", function () {
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

Then("vt-ptyのないプロトコル検査は正常終了する", function () {
  assert.deepEqual(this.nativeResult.status, 0);
});

Then("プロトコル検査はvt-ptyがないためskipしたことを表示する", function () {
  assert.deepEqual(
    this.nativeResult.stdout,
    "SKIP: libghostty-vt のプロトコル検査（vt-pty がありません）\n",
  );
});

Then("vt-ptyのないPiプロトコル検査は正常終了する", function () {
  assert.deepEqual(this.nativeResult.status, 0);
});

Then("Piプロトコル検査はvt-ptyがないためskipしたことを表示する", function () {
  assert.deepEqual(
    this.nativeResult.stdout,
    "SKIP: Pi を通したプロトコル検査（vt-pty がありません）\n",
  );
});

Then("vt-ptyのないストリーミング検査は正常終了する", function () {
  assert.deepEqual(this.nativeResult.status, 0);
});

Then("ストリーミング検査はvt-ptyがないためskipしたことを表示する", function () {
  assert.deepEqual(
    this.nativeResult.stdout,
    "SKIP: ストリーミング中のプロトコル検査（vt-pty がありません）\n",
  );
});

Then("複数のフレームが時系列で検査されたと報告される", function () {
  assert.equal(
    /streaming-protocol: frames=([2-9]|[1-9][0-9]+)/u.test(
      this.nativeResult.stdout,
    ),
    true,
    this.nativeResult.stderr || this.nativeResult.stdout,
  );
});

Then("先行する tool 出力を保った3回の差分描画が報告される", function () {
  assert.equal(
    this.nativeResult.stdout.includes(
      "streaming-protocol: streaming_updates=3 preceding_tool=preserved full_clears=0",
    ),
    true,
    this.nativeResult.stderr || this.nativeResult.stdout,
  );
});

Then(
  "各完了フレームの仮想配置と placeholder の画像 ID が対応すると報告される",
  function () {
    assert.equal(
      /streaming-protocol: complete_frames=\d+ placement_placeholders=matched/u.test(
        this.nativeResult.stdout,
      ),
      true,
      this.nativeResult.stderr || this.nativeResult.stdout,
    );
  },
);

Then("途中のどのフレームにも APC の断片がないと報告される", function () {
  assert.equal(
    this.nativeResult.stdout.includes("streaming-protocol: apc_leak=0"),
    true,
    this.nativeResult.stderr || this.nativeResult.stdout,
  );
});

Then("最終フレームの表示数式と仮想配置の数が一致する", function () {
  assert.equal(
    /streaming-protocol: final display_formulas=(\d+) virtual_images=\1/u.test(
      this.nativeResult.stdout,
    ),
    true,
    this.nativeResult.stderr || this.nativeResult.stdout,
  );
});

Then("環境変数で指定したvt-ptyは正常終了する", function () {
  assert.deepEqual(this.nativeResult.status, 0);
});

Then("環境変数で指定したvt-ptyの出力が返る", function () {
  assert.deepEqual(this.nativeResult.stdout, "selected vt-pty\n");
});

Then("vt-ptyのないエンコーダ検査は正常終了する", function () {
  assert.deepEqual(this.nativeResult.status, 0);
});

Then("エンコーダ検査はvt-ptyがないためskipしたことを表示する", function () {
  assert.deepEqual(
    this.nativeResult.stdout,
    "SKIP: エンコーダ層のプロトコル検査（vt-pty がありません）\n",
  );
});

Then("storage に計画どおりの PNG 画像が一件ある", function () {
  assert.equal(
    this.nativeResult.stdout,
    "encoder-protocol: storage ok\n",
    this.nativeResult.stderr,
  );
});

Then("隔離したエンコーダのstorage検査が報告される", function () {
  assert.equal(
    this.nativeResult.stdout.includes("encoder-protocol: storage ok"),
    true,
    this.nativeResult.stderr || this.nativeResult.stdout,
  );
});

Then("仮想配置の列数と行数が計画と一致する", function () {
  assert.equal(
    this.nativeResult.stdout,
    "encoder-protocol: placement ok\n",
    this.nativeResult.stderr,
  );
});

Then("foreground RGB から復元した画像 ID が計画と一致する", function () {
  assert.equal(
    this.nativeResult.stdout,
    "encoder-protocol: image-id ok\n",
    this.nativeResult.stderr,
  );
});

Then("diacritics から復元した座標が欠けも余りもなく並ぶ", function () {
  assert.equal(
    this.nativeResult.stdout,
    "encoder-protocol: coordinates ok\n",
    this.nativeResult.stderr,
  );
});

Then("すべての placeholder セルの下線色タグが RGB である", function () {
  assert.equal(
    this.nativeResult.stdout,
    "encoder-protocol: underline ok\n",
    this.nativeResult.stderr,
  );
});

Then("二回目も storage に画像がある", function () {
  assert.equal(
    this.nativeResult.stdout,
    "encoder-protocol: cached ok\n",
    this.nativeResult.stderr,
  );
});

Then("画像転送のないエンコーダ出力の検査は終了コード1を返す", function () {
  assert.deepEqual(this.nativeResult.status, 1);
});

Then(
  "エンコーダ検査はplaceholderのIDに仮想配置がないことを表示する",
  function () {
    assert.deepEqual(
      this.nativeResult.stderr.trim(),
      "placeholder が指す id に仮想配置がない",
    );
  },
);

Then("libghostty-vtのビルド計画は正常終了する", function () {
  assert.deepEqual(this.nativeResult.status, 0);
});

Then("libghostty-vtのビルド計画は固定したcommitを使う", function () {
  assert.deepEqual(
    this.buildPlan.pin,
    "349f026087d948f8f898dca3231ff91438f83ab8",
  );
});

Then("libghostty-vtのビルド計画は指定したprefixを使う", function () {
  assert.deepEqual(this.buildPlan.prefix, this.nativeTestDirectory);
});

Then("ビルド計画のheaderは指定prefixのincludeにある", function () {
  assert.deepEqual(
    this.buildPlan.include,
    path.join(this.nativeTestDirectory, "include"),
  );
});

Then("ビルド計画のlibraryは指定prefixのlibにある", function () {
  assert.deepEqual(
    this.buildPlan.library,
    path.join(this.nativeTestDirectory, "lib"),
  );
});

Then("ビルド計画のvt-ptyは指定prefixのbinにある", function () {
  assert.deepEqual(
    this.buildPlan["vt-tool"],
    path.join(this.nativeTestDirectory, "bin/vt-pty"),
  );
});

Then("Zigのビルド命令は指定prefixだけを使う", function () {
  assert.deepEqual(
    this.buildPlan["zig-command"],
    "zig build -Demit-lib-vt -Doptimize=ReleaseFast -Dcpu=baseline --prefix " +
      this.nativeTestDirectory,
  );
});

Then("プロトコルの本文セルにhelloが報告される", function () {
  assert.equal(
    this.nativeResult.stdout.includes('row[0]: placeholders=0 "hello"'),
    true,
    this.nativeResult.stderr || this.nativeResult.stdout,
  );
});

Then("必要な仮想配置を受け取ってからプロトコル状態が出力される", function () {
  assert.equal(
    this.nativeResult.stdout.includes("kitty.placements=1"),
    true,
    this.nativeResult.stderr || this.nativeResult.stdout,
  );
});

Then("出力の静止を待たずにプロトコル状態が出力される", function () {
  assert.equal(
    this.nativeResult.stdout.includes("kitty.placements=1"),
    true,
    this.nativeResult.stderr || this.nativeResult.stdout,
  );
});

Then("遅れて届いたplaceholderの画像IDと座標が報告される", function () {
  assert.equal(
    this.nativeResult.stdout.includes(
      "placeholder: image_id=0x000001 row=0 col=0",
    ),
    true,
    this.nativeResult.stderr || this.nativeResult.stdout,
  );
});

Then("timeout 時点の仮想配置数が出力される", function () {
  assert.equal(
    this.nativeResult.stderr.includes("waiting for 2 placements (observed 1)"),
    true,
    this.nativeResult.stderr || this.nativeResult.stdout,
  );
});

Then("長いgrapheme clusterの本文セルにaが報告される", function () {
  assert.equal(
    this.nativeResult.stdout.includes('row[0]: placeholders=0 "a"'),
    true,
    this.nativeResult.stderr || this.nativeResult.stdout,
  );
});

Then("timeout は成功として扱われない", function () {
  assert.equal(
    this.nativeResult.stderr.includes("waiting for 1 placements (observed 0)"),
    true,
    this.nativeResult.stderr || this.nativeResult.stdout,
  );
});

Then("子プロセスの起動失敗は成功として扱われない", function () {
  assert.equal(
    this.nativeResult.stderr.includes("child exited with status 127"),
    true,
    this.nativeResult.stderr || this.nativeResult.stdout,
  );
});

Then("本文セルの APC 断片を検出して失敗する", function () {
  assert.equal(
    /Pi を通した本文セルに APC の断片/u.test(this.nativeResult.stderr),
    true,
    this.nativeResult.stderr || this.nativeResult.stdout,
  );
});

Then("仮想配置に対応する placeholder の欠落を検出して失敗する", function () {
  assert.equal(
    this.nativeResult.stderr.includes(
      "仮想配置に対応する placeholder がありません",
    ),
    true,
    this.nativeResult.stderr || this.nativeResult.stdout,
  );
});

Then("描画が落ち着かないPiプロトコル検査は終了コード2を返す", function () {
  assert.deepEqual(this.nativeResult.status, 2);
});

Then("Piプロトコル検査は描画の時間切れの理由を表示する", function () {
  assert.deepEqual(this.nativeResult.stderr.trim(), "vt-pty: timeout 15000ms");
});

Then("placeholder セルの汚れがないと報告される", function () {
  assert.equal(
    this.nativeResult.stdout.includes("cells.dirty_placeholders=0"),
    true,
    this.nativeResult.stderr || this.nativeResult.stdout,
  );
});

Then("本文セルに APC の断片がないと報告される", function () {
  assert.equal(
    this.nativeResult.stdout.includes("cells.apc_leak=0"),
    true,
    this.nativeResult.stderr || this.nativeResult.stdout,
  );
});

Then("表示数式と storage 付き仮想配置の数が一致する", function () {
  assert.equal(
    /pi-protocol: display_formulas=(\d+) virtual_images=\1/u.test(
      this.nativeResult.stdout,
    ),
    true,
    this.nativeResult.stderr || this.nativeResult.stdout,
  );
});

Then("placeholder セルの汚れを検出して失敗する", function () {
  assert.equal(
    /Pi を通した placeholder セルに汚れ/u.test(this.nativeResult.stderr),
    true,
    this.nativeResult.stderr || this.nativeResult.stdout,
  );
});

Then("プロトコル検査の終了コードは {int} である", function (expected) {
  assert.equal(
    this.nativeResult.status,
    expected,
    this.nativeResult.stderr || this.nativeResult.stdout,
  );
});

Then("プロトコル検査の終了コードは0ではない", function () {
  assert.notEqual(
    this.nativeResult.status,
    0,
    this.nativeResult.stderr || this.nativeResult.stdout,
  );
});

Then("隔離したcheckoutにextensionのビルド成果物が作られる", function () {
  assert.equal(
    fs.existsSync(path.join(this.nativeTestDirectory, "dist/extension.js")),
    true,
    this.nativeResult.stderr || this.nativeResult.stdout,
  );
});

Then("プロトコルの画像配置数は0件と報告される", function () {
  assert.equal(
    this.nativeResult.stdout.includes("kitty.placements=0"),
    true,
    this.nativeResult.stderr || this.nativeResult.stdout,
  );
});

Then("プロトコルのAPC漏れは0件と報告される", function () {
  assert.equal(
    this.nativeResult.stdout.includes("cells.apc_leak=0"),
    true,
    this.nativeResult.stderr || this.nativeResult.stdout,
  );
});

Then("仮想配置に続くafter-placement本文が報告される", function () {
  assert.equal(
    this.nativeResult.stdout.includes("after-placement"),
    true,
    this.nativeResult.stderr || this.nativeResult.stdout,
  );
});

Then("長いgrapheme clusterのAPC漏れは0件と報告される", function () {
  assert.equal(
    this.nativeResult.stdout.includes("cells.apc_leak=0"),
    true,
    this.nativeResult.stderr || this.nativeResult.stdout,
  );
});

function terminalColorQuery(osc) {
  const program = `
process.stdin.setRawMode(true);
process.stdin.setEncoding("utf8");
let response = "";
const timeout = setTimeout(() => process.exit(1), 1000);
process.stdin.on("data", (data) => {
  response += data;
  if (!response.includes("\\x1b\\\\")) return;
  clearTimeout(timeout);
  process.stdout.write("terminal-color=" + JSON.stringify(response));
  process.stdin.pause();
});
process.stdout.write("\\x1b]${osc};?\\x1b\\\\");
`;
  return ["--settle-ms", "20", "--", process.execPath, "-e", program];
}

Given("vt-pty の既定前景色を問い合わせる子プロセスがある", function () {
  this.nativeCommand = terminalColorQuery(10);
});

Given("vt-pty の既定背景色を問い合わせる子プロセスがある", function () {
  this.nativeCommand = terminalColorQuery(11);
});

Then("子プロセスが既定前景色の応答を受け取る", function () {
  assert.match(this.nativeResult.stdout, /10;rgb:d8d8\/d8d8\/d8d8/u);
});

Then("子プロセスが既定背景色の応答を受け取る", function () {
  assert.match(this.nativeResult.stdout, /11;rgb:2828\/2c2c\/3434/u);
});
