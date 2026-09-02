const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const { After, Before, Given, Then, When } = require("@cucumber/cucumber");
const { resolveVtTool } = require("../../scripts/vt-tool");

const root = path.resolve(__dirname, "../..");
const readProjectFile = (file) =>
  fs.readFileSync(path.join(root, file), "utf8");

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
});

When("プロトコル検査の入口を実行する", function () {
  this.nativeResult = spawnSync(
    process.execPath,
    ["scripts/run-vt-pty.js", "--", "printf", "hello"],
    { cwd: root, encoding: "utf8", env: this.nativeEnvironment },
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
});

Then("環境変数で指定した vt-pty が実行される", function () {
  assert.deepEqual(
    { status: this.nativeResult.status, stdout: this.nativeResult.stdout },
    { status: 0, stdout: "selected vt-pty\n" },
    this.nativeResult.stderr,
  );
});

Given("vt-pty で文字を出力する子プロセスを起動する", function () {
  this.nativeCommand = ["--settle-ms", "20", "--", "printf", "hello"];
});

When("子プロセスの出力が落ち着くまで待つ", function () {
  this.nativeResult = spawnSync(this.vtTool, this.nativeCommand, {
    cwd: root,
    encoding: "utf8",
    timeout: 10_000,
  });
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

Given("libghostty-vt のビルド定義がある", function () {
  this.pin = readProjectFile("native/libghostty-vt.commit");
  this.buildScript = readProjectFile("scripts/build-vt-pty");
});

When("ビルド入力を調べる", function () {
  this.buildInput = {
    pinLines: this.pin.trimEnd().split("\n"),
    readsPin: this.buildScript.includes(
      'PIN_FILE="$ROOT/native/libghostty-vt.commit"',
    ),
    usesPinnedFetch: this.buildScript.includes(
      'git fetch --depth 1 origin "$PIN"',
    ),
    usesPrefix: this.buildScript.includes(
      'zig build -Demit-lib-vt -Doptimize=ReleaseFast --prefix "$PREFIX"',
    ),
  };
});

Then("一行の pin を指定 prefix のビルドへ使う", function () {
  assert.deepEqual(this.buildInput, {
    pinLines: ["349f026087d948f8f898dca3231ff91438f83ab8"],
    readsPin: true,
    usesPinnedFetch: true,
    usesPrefix: true,
  });
});

When("native 成果物の出力先を調べる", function () {
  this.nativeLocations = {
    cacheDefault: this.buildScript.includes(
      "$" + "{XDG_CACHE_HOME:-$HOME/.cache}/pi-formula/libghostty-vt",
    ),
    include: this.buildScript.includes('-I"$PREFIX/include"'),
    library: this.buildScript.includes('-L"$PREFIX/lib"'),
    noPkgConfig: !this.buildScript.includes("pkg-config"),
  };
});

Then("ヘッダとライブラリを指定 prefix だけから使う", function () {
  assert.deepEqual(this.nativeLocations, {
    cacheDefault: true,
    include: true,
    library: true,
    noPkgConfig: true,
  });
});

Given("CI の native 専用 job がある", function () {
  this.workflow = readProjectFile(".github/workflows/ci.yml");
});

When("native job のビルドとキャッシュを調べる", function () {
  this.nativeCi = {
    job: /^ {2}native-vt:/mu.test(this.workflow),
    platforms:
      this.workflow.includes("ubuntu-latest") &&
      this.workflow.includes("macos-latest"),
    pinKey: this.workflow.includes("hashFiles('native/libghostty-vt.commit')"),
    build: this.workflow.includes("scripts/build-vt-pty"),
    protocolTest: this.workflow.includes("PI_FORMULA_VT_TOOL"),
  };
});

Then("Linux と macOS で pin ごとの vt-pty を検査する", function () {
  assert.equal(Object.values(this.nativeCi).every(Boolean), true);
});

Given("libghostty-vt の運用文書がある", function () {
  this.nativeGuide = readProjectFile("docs/agents/libghostty-vt.md");
});

When("pin の更新手順を調べる", function () {
  this.pinChecks = {
    headers: ["terminal.h", "render.h", "style.h", "kitty_graphics.h"].every(
      (header) => this.nativeGuide.includes(header),
    ),
    tiers:
      this.nativeGuide.includes("Tier A") &&
      this.nativeGuide.includes("Tier B"),
    resources:
      this.nativeGuide.includes("ビルド時間") &&
      this.nativeGuide.includes("成果物サイズ"),
    isolatedPullRequest: this.nativeGuide.includes("独立した PR"),
  };
});

Then("API 差分と検査と資源量の変化を確認できる", function () {
  assert.equal(Object.values(this.pinChecks).every(Boolean), true);
});
