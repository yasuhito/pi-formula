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

function executablePath(command) {
  for (const directory of (process.env.PATH ?? "").split(path.delimiter)) {
    const candidate = path.join(directory, command);
    try {
      fs.accessSync(candidate, fs.constants.X_OK);
      return candidate;
    } catch {}
  }
  throw new Error(`テストに必要なコマンドがありません: ${command}`);
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
      if (command !== omitted) {
        fs.symlinkSync(
          executablePath(command),
          path.join(this.commandDirectory, command),
        );
      }
    }
    fs.writeFileSync(
      path.join(this.commandDirectory, "npm"),
      "#!/usr/bin/env bash\nexit 73\n",
      { mode: 0o755 },
    );
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
    },
    {
      theme: "light",
      themeFile: path.join(root, "scripts/verify-display-theme.json"),
      terminal: "ghostty",
      extension: path.join(root, "src/extension.ts"),
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

Then(
  /^選ばなかった `(ghostty|kitty)` の不足は報告されない$/u,
  function (other) {
    assert.deepEqual(
      {
        status: this.verifyDisplayResult.status,
        reportsMissingOther: this.verifyDisplayResult.stderr.includes(
          `必要なコマンドがありません: ${other}`,
        ),
      },
      { status: 2, reportsMissingOther: false },
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
