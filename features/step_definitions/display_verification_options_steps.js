const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const { Given, Then, When } = require("@cucumber/cucumber");

const root = path.resolve(__dirname, "../..");

function describeDisplay(...options) {
  return spawnSync(
    path.join(root, "scripts/verify-display"),
    ["--describe", ...options],
    { encoding: "utf8", timeout: 5_000 },
  );
}

When("暗いテーマの実表示検証契約を出力する", function () {
  this.verifyDisplayResult = describeDisplay("--theme", "dark");
});

When("Kitty の実表示検証契約を出力する", function () {
  this.verifyDisplayResult = describeDisplay("--terminal", "kitty");
});

When("テキスト経路の実表示検証契約を出力する", function () {
  this.verifyDisplayResult = describeDisplay("--path", "text");
});

When("100 列へ描き直す実表示検証契約を出力する", function () {
  this.verifyDisplayResult = describeDisplay("--reflow", "100");
});

When("公開候補の拡張を指定して実表示検証契約を出力する", function () {
  this.verifyDisplayResult = describeDisplay(
    "--extension",
    "/tmp/x/src/extension.ts",
  );
});

Given(
  /^未知の `([^`]+)` と `([^`]+)` を持つ実表示検証コマンドがある$/u,
  function (option, value) {
    this.verifyDisplayArguments = ["--describe", option, value];
  },
);

const requiredCommands = [
  "bash",
  "timeout",
  "cage",
  "wlr-randr",
  "ghostty",
  "kitty",
  "grim",
  "pi",
  "jq",
  "node",
  "mktemp",
  "realpath",
  "rm",
  "sleep",
  "install",
  "setsid",
  "mkdir",
];

const commandFixture = `#!/usr/bin/env node
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const command = path.basename(process.argv[1]);
const args = process.argv.slice(2);
if (command === "timeout") {
  if (args[0]?.startsWith("--signal=")) args.shift();
  args.shift();
  const result = spawnSync(args[0], args.slice(1), { stdio: "inherit" });
  process.exit(result.status ?? 2);
}
if (command === "realpath") {
  console.log(path.resolve(args.at(-1)));
} else if (command === "mktemp") {
  console.log(fs.mkdtempSync(path.join(os.tmpdir(), "verify-display-fixture-")));
} else if (command === "mkdir") {
  fs.mkdirSync(args.at(-1), { recursive: true });
} else if (command === "rm") {
  fs.rmSync(args.at(-1), { recursive: true, force: true });
} else if (command === "npm") {
  if (process.env.PI_FORMULA_FULL_FIXTURE !== "1") {
    console.error("verify-display fixture sentinel");
    process.exit(73);
  }
} else if (command === "jq") {
  console.log("80");
} else if (command === "wlr-randr") {
  if (args.length === 0) {
    console.log("HEADLESS-1 connected");
  } else {
    const dimensions = args.at(-1);
    fs.writeFileSync(process.env.PI_FORMULA_FIXTURE_DIMENSIONS, dimensions);
    fs.appendFileSync(process.env.PI_FORMULA_FIXTURE_MODES, dimensions + "\\n");
  }
} else if (command === "grim") {
  const [width, height] = fs
    .readFileSync(process.env.PI_FORMULA_FIXTURE_DIMENSIONS, "utf8")
    .trim()
    .split("x")
    .map(Number);
  const { createPng } = require(process.env.PI_FORMULA_FIXTURE_PNG_MODULE);
  fs.writeFileSync(
    args.at(-1),
    createPng(width, height, (x, y) =>
      x < Math.max(2, Math.floor(width / 100)) && y < Math.max(2, Math.floor(height / 5))
        ? [40, 40, 35]
        : [250, 248, 240],
    ),
  );
} else if (command === "cage") {
  const separator = args.indexOf("--");
  const result = spawnSync(args[separator + 1], args.slice(separator + 2), {
    env: { ...process.env, WAYLAND_DISPLAY: "wayland-fixture" },
    stdio: "inherit",
  });
  process.exit(result.status ?? 2);
} else if (command === "ghostty" || command === "kitty") {
  const executable =
    command === "ghostty" ? args[args.indexOf("-e") + 1] : args.at(-1);
  const result = spawnSync(executable, [], { stdio: "inherit" });
  process.exit(result.status ?? 2);
} else if (command === "pi") {
  const session = args[args.indexOf("--session") + 1];
  const corpusArgument = args.find((argument) => argument.startsWith("@"));
  const response = fs.readFileSync(corpusArgument.slice(1), "utf8");
  const configFile = path.join(
    process.env.XDG_CONFIG_HOME,
    "pi-formula",
    "config.json",
  );
  let selected = "image";
  if (fs.existsSync(configFile)) {
    selected = JSON.parse(fs.readFileSync(configFile, "utf8")).path ?? selected;
  }
  fs.writeFileSync(process.env.PI_FORMULA_VERIFY_IMAGE_MARKER, selected + "\\n");
  fs.appendFileSync(process.env.PI_FORMULA_FIXTURE_PATHS, selected + "\\n");
  fs.writeFileSync(
    session,
    JSON.stringify({
      type: "message",
      message: {
        role: "assistant",
        stopReason: "stop",
        content: [{ type: "text", text: response }],
      },
    }) + "\\n",
  );
  setInterval(() => {}, 1_000);
}
`;

function writeCommandFixture(directory, command) {
  const filename = path.join(directory, command);
  fs.writeFileSync(filename, commandFixture, { mode: 0o755 });
}

Given(
  /^`(ghostty|kitty)` だけがある実表示検証のコマンド環境がある$/u,
  function (selected) {
    this.directory = fs.mkdtempSync(
      path.join(os.tmpdir(), "pi-formula-cucumber-terminal-"),
    );
    this.commandDirectory = path.join(this.directory, "bin");
    fs.mkdirSync(this.commandDirectory);
    const omitted = selected === "ghostty" ? "kitty" : "ghostty";
    for (const command of requiredCommands) {
      if (command === omitted) continue;
      if (command === "bash") {
        fs.symlinkSync("/bin/bash", path.join(this.commandDirectory, command));
      } else if (command === "node") {
        fs.symlinkSync(
          process.execPath,
          path.join(this.commandDirectory, command),
        );
      } else {
        writeCommandFixture(this.commandDirectory, command);
      }
    }
    writeCommandFixture(this.commandDirectory, "npm");
  },
);

When(
  /^`(ghostty|kitty)` を選んで実表示検証コマンドを実行する$/u,
  function (selected) {
    this.verifyDisplayResult = spawnSync(
      path.join(root, "scripts/verify-display"),
      [
        "--terminal",
        selected,
        path.join(root, "docs/agents/verify-corpus/issue-21.md"),
      ],
      {
        encoding: "utf8",
        env: { ...process.env, PATH: this.commandDirectory },
        timeout: 5_000,
      },
    );
    fs.rmSync(this.directory, { recursive: true, force: true });
  },
);

Then("明るいテーマと Ghostty と現在の拡張が解決される", function () {
  const contract = JSON.parse(this.verifyDisplayResult.stdout || "null");
  assert.deepEqual(
    {
      theme: contract?.theme,
      themeFile: contract?.themeFile,
      terminal: contract?.terminal,
      extension: contract?.extension,
      reflow: contract?.reflow,
      path: contract?.path,
    },
    {
      theme: "light",
      themeFile: path.join(root, "scripts/verify-display-theme.json"),
      terminal: "ghostty",
      extension: path.join(root, "src/extension.ts"),
      reflow: null,
      path: "image",
    },
  );
});

Then("暗いテーマファイルが解決される", function () {
  const contract = JSON.parse(this.verifyDisplayResult.stdout || "null");
  assert.deepEqual(
    { theme: contract?.theme, themeFile: contract?.themeFile },
    {
      theme: "dark",
      themeFile: path.join(root, "scripts/verify-display-theme-dark.json"),
    },
  );
});

Then("実表示検証の端末が Kitty に解決される", function () {
  const contract = JSON.parse(this.verifyDisplayResult.stdout || "null");
  assert.equal(contract?.terminal, "kitty");
});

Then("実表示検証の表示経路がテキスト経路に解決される", function () {
  const contract = JSON.parse(this.verifyDisplayResult.stdout || "null");
  assert.equal(contract?.path, "text");
});

Then("実表示検証の描き直す端末幅が 100 列に解決される", function () {
  const contract = JSON.parse(this.verifyDisplayResult.stdout || "null");
  assert.equal(contract?.reflow, 100);
});

Then(
  /^選ばなかった `(ghostty|kitty)` の不足は報告されない$/u,
  function (other) {
    assert.deepEqual(
      {
        status: this.verifyDisplayResult.status,
        reachedSentinel: this.verifyDisplayResult.stderr.includes(
          "verify-display fixture sentinel",
        ),
        reportsMissingOther: this.verifyDisplayResult.stderr.includes(
          `必要なコマンドがありません: ${other}`,
        ),
      },
      { status: 2, reachedSentinel: true, reportsMissingOther: false },
    );
  },
);

Then("指定した拡張パスが解決される", function () {
  const contract = JSON.parse(this.verifyDisplayResult.stdout || "null");
  assert.equal(contract?.extension, "/tmp/x/src/extension.ts");
});

Then("未知の実表示検証設定は終了コード2で断られる", function () {
  assert.equal(this.verifyDisplayResult.status, 2);
});

const fullFixtureCommands = [
  "cage",
  "ghostty",
  "grim",
  "jq",
  "kitty",
  "npm",
  "pi",
  "wlr-randr",
];

Given("実表示検証用コマンドの stub 環境がある", function () {
  this.directory = fs.mkdtempSync(
    path.join(os.tmpdir(), "pi-formula-cucumber-display-"),
  );
  this.commandDirectory = path.join(this.directory, "bin");
  fs.mkdirSync(this.commandDirectory);
  for (const command of fullFixtureCommands) {
    writeCommandFixture(this.commandDirectory, command);
  }
  this.fixtureDimensions = path.join(this.directory, "dimensions");
  this.fixtureModes = path.join(this.directory, "modes");
  this.fixturePaths = path.join(this.directory, "paths");
  this.fixtureCapture = path.join(this.directory, "capture.png");
  this.fixtureEnvironment = {
    ...process.env,
    PATH: `${this.commandDirectory}${path.delimiter}${process.env.PATH}`,
    PI_FORMULA_FULL_FIXTURE: "1",
    PI_FORMULA_FIXTURE_DIMENSIONS: this.fixtureDimensions,
    PI_FORMULA_FIXTURE_MODES: this.fixtureModes,
    PI_FORMULA_FIXTURE_PATHS: this.fixturePaths,
    PI_FORMULA_FIXTURE_PNG_MODULE: path.join(
      root,
      "test/support/png-fixture.js",
    ),
    PI_FORMULA_VERIFY_CAPTURE: this.fixtureCapture,
  };
});

function runFullFixture(world, ...options) {
  world.verifyDisplayResult = spawnSync(
    path.join(root, "scripts/verify-display"),
    [...options, path.join(root, "docs/agents/verify-corpus/issue-21.md")],
    { encoding: "utf8", env: world.fixtureEnvironment, timeout: 30_000 },
  );
  world.fixtureObservation = {
    status: world.verifyDisplayResult.status,
    modes: fs.existsSync(world.fixtureModes)
      ? fs.readFileSync(world.fixtureModes, "utf8").trim().split("\n")
      : [],
    paths: fs.existsSync(world.fixturePaths)
      ? fs.readFileSync(world.fixturePaths, "utf8").trim().split("\n")
      : [],
    captureSize: fs.existsSync(world.fixtureCapture)
      ? spawnSync(
          process.execPath,
          [
            path.join(root, "scripts/verify-display-dimensions.js"),
            "size",
            world.fixtureCapture,
          ],
          { encoding: "utf8", timeout: 5_000 },
        ).stdout.trim()
      : "missing",
  };
  fs.rmSync(world.directory, { recursive: true, force: true });
}

When("100 列へ描き直して実表示検証する", function () {
  runFullFixture(this, "--reflow", "100");
});

Then("幅変更後のキャプチャが残る", function () {
  assert.deepEqual(this.fixtureObservation, {
    status: 0,
    modes: ["1920x80", "816x80"],
    paths: ["image"],
    captureSize: "816x80",
  });
});

When("テキスト経路で実表示検証する", function () {
  runFullFixture(this, "--path", "text");
});

Then("画像経路を要求せずテキスト経路のキャプチャが残る", function () {
  assert.deepEqual(this.fixtureObservation, {
    status: 0,
    modes: ["1920x80"],
    paths: ["text"],
    captureSize: "1920x80",
  });
});
