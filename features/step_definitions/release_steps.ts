interface StepWorld {
  changelog: string;
  changelogVersion: string;
  operations: string;
  preparation: import("node:child_process").SpawnSyncReturns<string>;
  publishJob: string;
  releaseDirectory: string;
  releaseGuide: string;
  releaseNotes: string | null;
  releaseTag: string;
  releaseWorkflow: string;
  similarVersionChangelog: string;
}

const assert: typeof import("node:assert/strict") = require("node:assert/strict");
const {
  mkdtempSync,
  readFileSync,
  rmSync,
}: typeof import("node:fs") = require("node:fs");
const { tmpdir }: typeof import("node:os") = require("node:os");
const { join, resolve }: typeof import("node:path") = require("node:path");
const {
  spawnSync,
}: typeof import("node:child_process") = require("node:child_process");
const {
  After,
  Given,
  Then,
  When,
}: typeof import("@cucumber/cucumber") = require("@cucumber/cucumber");
const {
  extractReleaseNotes,
}: typeof import("../../scripts/release-notes") = require("../../scripts/release-notes");

const root = resolve(__dirname, "../..");
const readProjectFile = (path: string) =>
  readFileSync(join(root, path), "utf8");

After(function (this: StepWorld) {
  if (this.releaseDirectory) {
    rmSync(this.releaseDirectory, { recursive: true, force: true });
  }
});

Given("package.json と異なる版の公開タグがある", function (this: StepWorld) {
  this.releaseTag = "v9.9.9";
});

Given("package.json と同じ版の公開タグがある", function (this: StepWorld) {
  const manifest = JSON.parse(readProjectFile("package.json"));
  this.releaseTag = `v${manifest.version}`;
});

When("公開準備を実行する", function (this: StepWorld) {
  this.releaseDirectory = mkdtempSync(join(tmpdir(), "pi-formula-release-"));
  this.preparation = spawnSync(
    process.execPath,
    ["scripts/prepare-release.js", this.releaseTag, this.releaseDirectory],
    { cwd: root, encoding: "utf8" },
  );
});

Then("版が異なるタグの公開準備は終了コード1を返す", function (this: StepWorld) {
  assert.deepEqual(this.preparation.status, 1);
});

Then(
  "公開準備はpackageの版とタグの不一致を表示する",
  function (this: StepWorld) {
    assert.deepEqual(
      /does not match package\.json version/u.test(this.preparation.stderr),
      true,
    );
  },
);

Then(
  "版が異なるタグの公開準備では配布ファイルを作らない",
  function (this: StepWorld) {
    assert.deepEqual(require("node:fs").readdirSync(this.releaseDirectory), []);
  },
);

Then("版が一致する公開準備は正常終了する", function (this: StepWorld) {
  assert.deepEqual(this.preparation.status, 0);
});

Then("公開準備コマンドは全チェックを通してから配布物を作る", () => {
  const manifest = JSON.parse(readProjectFile("package.json"));
  const packageScripts = manifest.scripts;
  assert.deepEqual(
    packageScripts["release:prepare"],
    "npm run check && node scripts/prepare-release.js",
  );
});

Then(
  "公開準備では同じ版のtarballとリリースノートが用意される",
  function (this: StepWorld) {
    const manifest = JSON.parse(readProjectFile("package.json"));
    const files = require("node:fs").readdirSync(this.releaseDirectory).sort();
    assert.deepEqual(files, [
      `pi-formula-${manifest.version}.tgz`,
      "release-notes.md",
    ]);
  },
);

Then("公開workflowは公開準備コマンドを使う", () => {
  assert.deepEqual(
    /npm run release:prepare --/u.test(
      readProjectFile(".github/workflows/release.yml"),
    ),
    true,
  );
});

Given("npm 公開用の GitHub Actions がある", function (this: StepWorld) {
  this.releaseWorkflow = readProjectFile(".github/workflows/release.yml");
  this.releaseGuide = readProjectFile("docs/releasing.md");
});

When("公開ジョブの権限と環境を調べる", function (this: StepWorld) {
  this.publishJob = this.releaseWorkflow;
});

Then("公開workflowは版のタグpushで起動する", function (this: StepWorld) {
  assert.deepEqual(
    /tags:\s*\n\s*- ['"]v\*\.\*\.\*['"]/u.test(this.publishJob),
    true,
  );
});

Then("公開workflowは承認用のnpm環境を使う", function (this: StepWorld) {
  assert.deepEqual(/environment:\s*npm/u.test(this.publishJob), true);
});

Then(
  "npm環境で許可する操作はnpm publishと案内される",
  function (this: StepWorld) {
    assert.deepEqual(
      /Allowed actions: `npm publish`/u.test(this.releaseGuide),
      true,
    );
  },
);

Then("公開workflowにはOIDCのtoken発行権限がある", function (this: StepWorld) {
  assert.deepEqual(/id-token:\s*write/u.test(this.publishJob), true);
});

Then("npm公開では由来証明を付ける", function (this: StepWorld) {
  assert.deepEqual(/npm publish .*--provenance/u.test(this.publishJob), true);
});

Then("公開workflowにはnpm tokenを設定しない", function (this: StepWorld) {
  assert.deepEqual(!/NODE_AUTH_TOKEN|NPM_TOKEN/u.test(this.publishJob), true);
});

Then(
  "リリースノートは同じ版のCHANGELOGの本文と一致する",
  function (this: StepWorld) {
    const manifest = JSON.parse(readProjectFile("package.json"));
    const changelogLines = readProjectFile("CHANGELOG.md").split("\n");
    const headingIndex = changelogLines.findIndex(
      (line) =>
        line === `## ${manifest.version}` ||
        line.startsWith(`## ${manifest.version} `),
    );
    const bulletLines = changelogLines.slice(headingIndex + 2);
    const firstNonBullet = bulletLines.findIndex(
      (line) => !line.startsWith("- "),
    );
    const bulletEnd =
      firstNonBullet === -1 ? bulletLines.length : firstNonBullet;
    const expectedNotes = `${bulletLines.slice(0, bulletEnd).join("\n")}\n`;
    const notes = readFileSync(
      join(this.releaseDirectory, "release-notes.md"),
      "utf8",
    );
    assert.deepEqual(notes, expectedNotes);
  },
);

Then("Releaseの題名にはpackageの版が含まれる", () => {
  const workflow = readProjectFile(".github/workflows/release.yml");
  assert.deepEqual(/--title "pi-formula \$\{VERSION\}"/u.test(workflow), true);
});

Then("Releaseの本文には同じ版のリリースノートを使う", () => {
  const workflow = readProjectFile(".github/workflows/release.yml");
  assert.deepEqual(/--notes-file .*release-notes\.md/u.test(workflow), true);
});

Given(
  "CHANGELOG に現在の版から始まる別の版だけがある",
  function (this: StepWorld) {
    this.similarVersionChangelog = [
      "## 0.1.00 - Unreleased",
      "",
      "- Wrong numeric version.",
      "",
      "## 0.1.0x - Unreleased",
      "",
      "- Wrong suffix version.",
      "",
    ].join("\n");
  },
);

When("現在の版の Release 本文を取り出す", function (this: StepWorld) {
  this.releaseNotes = extractReleaseNotes(
    this.similarVersionChangelog,
    "0.1.0",
  );
});

Then("現在の版の Release 本文は見つからない", function (this: StepWorld) {
  assert.equal(this.releaseNotes, null);
});

Given(
  "CHANGELOG に継続行を持つ箇条書きと次の箇条書きがある",
  function (this: StepWorld) {
    this.changelog = [
      "## 0.1.0 - Unreleased",
      "",
      "- First change",
      "  continues on the next line.",
      "",
      "- Second change",
      "  also continues.",
      "",
      "## 0.2.0 - Unreleased",
      "",
      "- Later release.",
      "",
    ].join("\n");
    this.changelogVersion = "0.1.0";
  },
);

Given("CHANGELOG の版に空の箇条書きしかない", function (this: StepWorld) {
  this.changelog = "## 0.1.0 - Unreleased\n\n- \n";
  this.changelogVersion = "0.1.0";
});

When("その版の Release 本文を取り出す", function (this: StepWorld) {
  this.releaseNotes = extractReleaseNotes(
    this.changelog,
    this.changelogVersion,
  );
});

Then("継続行と次の箇条書きが同じ順で保持される", function (this: StepWorld) {
  assert.equal(
    this.releaseNotes,
    [
      "- First change",
      "  continues on the next line.",
      "",
      "- Second change",
      "  also continues.",
      "",
    ].join("\n"),
  );
});

Then("Release 本文は見つからない", function (this: StepWorld) {
  assert.equal(this.releaseNotes, null);
});

Given("継続公開の運用手順がある", function (this: StepWorld) {
  this.releaseGuide = readProjectFile("docs/releasing.md");
});

When("公開後と公開失敗時の手順を調べる", function (this: StepWorld) {
  this.operations = this.releaseGuide;
});

Then("公開後にnpmの版を確認する手順がある", function (this: StepWorld) {
  assert.deepEqual(/npm view pi-formula/u.test(this.operations), true);
});

Then("公開後に遠隔タグを確認する手順がある", function (this: StepWorld) {
  assert.deepEqual(
    /git ls-remote[^\n]*refs\/tags/u.test(this.operations),
    true,
  );
});

Then("公開後にGitHub Releaseを確認する手順がある", function (this: StepWorld) {
  assert.deepEqual(/gh release view/u.test(this.operations), true);
});

Then("公開後に由来証明を確認する手順がある", function (this: StepWorld) {
  assert.deepEqual(/npm audit signatures/u.test(this.operations), true);
});

Then(
  "外部条件が不足した公開は再試行しないと案内される",
  function (this: StepWorld) {
    assert.deepEqual(/再試行しない/u.test(this.operations), true);
  },
);

Then("公開条件の不足を報告する手順がある", function (this: StepWorld) {
  assert.deepEqual(/不足条件/u.test(this.operations), true);
});
