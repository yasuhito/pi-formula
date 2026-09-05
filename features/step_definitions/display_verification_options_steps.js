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
  console.error("verify-display fixture sentinel");
  process.exit(73);
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
