const assert = require("node:assert/strict");
const {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} = require("node:fs");
const { tmpdir } = require("node:os");
const { join, resolve } = require("node:path");
const { spawnSync } = require("node:child_process");
const { gzipSync } = require("node:zlib");
const { After, Given, Then, When } = require("@cucumber/cucumber");
const { extractReleaseNotes } = require("../../scripts/release-notes");

const root = resolve(__dirname, "../..");
const readProjectFile = (path) => readFileSync(join(root, path), "utf8");

After(function () {
  if (this.releaseDirectory) {
    rmSync(this.releaseDirectory, { recursive: true, force: true });
  }
});

Given("初回 npm 公開の手順がある", function () {
  this.releaseGuide = readProjectFile("docs/releasing.md");
  this.initialPublisher = readProjectFile("scripts/publish-initial.sh");
});

When("1Password から npm 認証情報を渡す方法を調べる", function () {
  this.initialPublishInstructions = `${this.releaseGuide}\n${this.initialPublisher}`;
});

Then("初回公開手順は1Passwordのop runを使う", function () {
  assert.deepEqual(/\bop run\b/u.test(this.initialPublishInstructions), true);
});

Then("初回公開手順はtokenとOTPの秘密参照を使う", function () {
  assert.deepEqual(
    /OP_NPM_TOKEN_REF/u.test(this.initialPublishInstructions) &&
      /OP_NPM_OTP_REF/u.test(this.initialPublishInstructions),
    true,
  );
});

Then("初回公開スクリプトはshell traceを止める", function () {
  assert.deepEqual(/set \+x/u.test(this.initialPublisher), true);
});

Then("初回公開スクリプトは一時npmrcを作って終了時に削除する", function () {
  assert.deepEqual(
    /mktemp/u.test(this.initialPublisher) &&
      /trap/u.test(this.initialPublisher),
    true,
  );
});

Then("初回公開スクリプトは秘密の値を表示する指定を使わない", function () {
  assert.deepEqual(!/--reveal/u.test(this.initialPublisher), true);
});

Given("初回版が 1Password で npm に公開済みである", function () {
  this.releaseGuide = readProjectFile("docs/releasing.md");
  this.releaseWorkflow = readProjectFile(".github/workflows/release.yml");
});

When("初回版の遠隔タグと Release を作る経路を調べる", function () {
  this.initialReleaseJob = this.releaseWorkflow.slice(
    this.releaseWorkflow.indexOf("\n  initial-release:"),
  );
});

Then("初回Releaseを手動で起動できる", function () {
  assert.deepEqual(/workflow_dispatch:/u.test(this.releaseWorkflow), true);
});

Then("初回Releaseジョブは手動起動時だけ動く", function () {
  assert.deepEqual(
    /if: github\.event_name == 'workflow_dispatch'/u.test(
      this.initialReleaseJob,
    ),
    true,
  );
});

Then("二つのタグ公開ジョブはpush時だけ動く", function () {
  assert.deepEqual(
    (this.releaseWorkflow.match(/if: github\.event_name == 'push'/gu) ?? [])
      .length,
    2,
  );
});

Then("初回Releaseはnpm公開を確認してからタグを作る", function () {
  const npmCheck = this.initialReleaseJob.indexOf("npm view");
  const tagCreation = this.initialReleaseJob.indexOf("git/refs");
  assert.deepEqual(npmCheck !== -1 && npmCheck < tagCreation, true);
});

Then("初回Releaseは同じ版の遠隔タグを作る", function () {
  assert.deepEqual(
    /refs\/tags\/\$\{RELEASE_TAG\}/u.test(this.initialReleaseJob),
    true,
  );
});

Then("初回Releaseは同じ版のGitHub Releaseを作る", function () {
  assert.deepEqual(
    /gh release create "\$\{RELEASE_TAG\}"/u.test(this.initialReleaseJob),
    true,
  );
});

Then("初回Releaseの題名には同じ版が含まれる", function () {
  assert.deepEqual(
    /--title "pi-formula \$\{VERSION\}"/u.test(this.initialReleaseJob),
    true,
  );
});

Then("初回Releaseの本文には作成したリリースノートを使う", function () {
  assert.deepEqual(
    /--notes-file \.release\/release-notes\.md/u.test(this.initialReleaseJob),
    true,
  );
});

Then("初回Releaseはnpmへ再公開しない", function () {
  assert.deepEqual(!/npm publish/u.test(this.initialReleaseJob), true);
});

Then(
  "初回Releaseのタグ作成はタグ公開処理を再起動しないと案内される",
  function () {
    assert.deepEqual(
      /GITHUB_TOKEN[^\n]*タグ push 用の公開処理は新しく起動せず/u.test(
        this.releaseGuide,
      ),
      true,
    );
  },
);

Then("初回版には由来証明がない例外が案内される", function () {
  assert.deepEqual(
    /初回版[^。]*由来証明は付かない/u.test(this.releaseGuide),
    true,
  );
});

Given(
  "同じ tar ストリームを異なる圧縮レベルで gzip にした二つの tarball がある",
  function () {
    this.releaseDirectory = mkdtempSync(join(tmpdir(), "pi-formula-tarball-"));
    const packageDirectory = join(this.releaseDirectory, "package");
    const tarPath = join(this.releaseDirectory, "package.tar");
    mkdirSync(packageDirectory);
    writeFileSync(
      join(packageDirectory, "contents.txt"),
      "verified release contents\n".repeat(1024),
    );
    spawnSync("tar", ["-cf", tarPath, "-C", this.releaseDirectory, "package"]);
    const tarStream = readFileSync(tarPath);
    this.firstTarball = join(this.releaseDirectory, "first.tgz");
    this.secondTarball = join(this.releaseDirectory, "second.tgz");
    writeFileSync(this.firstTarball, gzipSync(tarStream, { level: 1 }));
    writeFileSync(this.secondTarball, gzipSync(tarStream, { level: 9 }));
  },
);

When("tarball の中身を照合する", function () {
  this.tarballComparison = spawnSync(
    "scripts/compare-tarball-contents.sh",
    [this.firstTarball, this.secondTarball],
    { cwd: root, encoding: "utf8" },
  );
});

Then("tarball の中身は一致する", function () {
  assert.equal(this.tarballComparison.status, 0, this.tarballComparison.stderr);
});

Given("package.json と異なる版の公開タグがある", function () {
  this.releaseTag = "v9.9.9";
});

Given("package.json と同じ版の公開タグがある", function () {
  const manifest = JSON.parse(readProjectFile("package.json"));
  this.releaseTag = `v${manifest.version}`;
});

When("公開準備を実行する", function () {
  this.releaseDirectory = mkdtempSync(join(tmpdir(), "pi-formula-release-"));
  this.preparation = spawnSync(
    process.execPath,
    ["scripts/prepare-release.js", this.releaseTag, this.releaseDirectory],
    { cwd: root, encoding: "utf8" },
  );
});

Then("版が異なるタグの公開準備は終了コード1を返す", function () {
  assert.deepEqual(this.preparation.status, 1);
});

Then("公開準備はpackageの版とタグの不一致を表示する", function () {
  assert.deepEqual(
    /does not match package\.json version/u.test(this.preparation.stderr),
    true,
  );
});

Then("版が異なるタグの公開準備では配布ファイルを作らない", function () {
  assert.deepEqual(require("node:fs").readdirSync(this.releaseDirectory), []);
});

Then("版が一致する公開準備は正常終了する", function () {
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

Then("公開準備では同じ版のtarballとリリースノートが用意される", function () {
  const manifest = JSON.parse(readProjectFile("package.json"));
  const files = require("node:fs").readdirSync(this.releaseDirectory).sort();
  assert.deepEqual(files, [
    `pi-formula-${manifest.version}.tgz`,
    "release-notes.md",
  ]);
});

Then("公開workflowは公開準備コマンドを使う", () => {
  assert.deepEqual(
    /npm run release:prepare --/u.test(
      readProjectFile(".github/workflows/release.yml"),
    ),
    true,
  );
});

Given("npm 公開用の GitHub Actions がある", function () {
  this.releaseWorkflow = readProjectFile(".github/workflows/release.yml");
  this.releaseGuide = readProjectFile("docs/releasing.md");
});

When("公開ジョブの権限と環境を調べる", function () {
  this.publishJob = this.releaseWorkflow;
});

Then("公開workflowは版のタグpushで起動する", function () {
  assert.deepEqual(
    /tags:\s*\n\s*- ['"]v\*\.\*\.\*['"]/u.test(this.publishJob),
    true,
  );
});

Then("公開workflowは承認用のnpm環境を使う", function () {
  assert.deepEqual(/environment:\s*npm/u.test(this.publishJob), true);
});

Then("npm環境で許可する操作はnpm publishと案内される", function () {
  assert.deepEqual(
    /Allowed actions: `npm publish`/u.test(this.releaseGuide),
    true,
  );
});

Then("公開workflowにはOIDCのtoken発行権限がある", function () {
  assert.deepEqual(/id-token:\s*write/u.test(this.publishJob), true);
});

Then("npm公開では由来証明を付ける", function () {
  assert.deepEqual(/npm publish .*--provenance/u.test(this.publishJob), true);
});

Then("公開workflowにはnpm tokenを設定しない", function () {
  assert.deepEqual(!/NODE_AUTH_TOKEN|NPM_TOKEN/u.test(this.publishJob), true);
});

Then("リリースノートは同じ版のCHANGELOGの本文と一致する", function () {
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
  const bulletEnd = firstNonBullet === -1 ? bulletLines.length : firstNonBullet;
  const expectedNotes = `${bulletLines.slice(0, bulletEnd).join("\n")}\n`;
  const notes = readFileSync(
    join(this.releaseDirectory, "release-notes.md"),
    "utf8",
  );
  assert.deepEqual(notes, expectedNotes);
});

Then("Releaseの題名にはpackageの版が含まれる", () => {
  const workflow = readProjectFile(".github/workflows/release.yml");
  assert.deepEqual(/--title "pi-formula \$\{VERSION\}"/u.test(workflow), true);
});

Then("Releaseの本文には同じ版のリリースノートを使う", () => {
  const workflow = readProjectFile(".github/workflows/release.yml");
  assert.deepEqual(/--notes-file .*release-notes\.md/u.test(workflow), true);
});

Given("CHANGELOG に現在の版から始まる別の版だけがある", function () {
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
});

When("現在の版の Release 本文を取り出す", function () {
  this.releaseNotes = extractReleaseNotes(
    this.similarVersionChangelog,
    "0.1.0",
  );
});

Then("現在の版の Release 本文は見つからない", function () {
  assert.equal(this.releaseNotes, null);
});

Given("CHANGELOG に継続行を持つ箇条書きと次の箇条書きがある", function () {
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
});

Given("CHANGELOG の版に空の箇条書きしかない", function () {
  this.changelog = "## 0.1.0 - Unreleased\n\n- \n";
  this.changelogVersion = "0.1.0";
});

When("その版の Release 本文を取り出す", function () {
  this.releaseNotes = extractReleaseNotes(
    this.changelog,
    this.changelogVersion,
  );
});

Then("継続行と次の箇条書きが同じ順で保持される", function () {
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

Then("Release 本文は見つからない", function () {
  assert.equal(this.releaseNotes, null);
});

Given("継続公開の運用手順がある", function () {
  this.releaseGuide = readProjectFile("docs/releasing.md");
});

When("公開後と公開失敗時の手順を調べる", function () {
  this.operations = this.releaseGuide;
});

Then("公開後にnpmの版を確認する手順がある", function () {
  assert.deepEqual(/npm view pi-formula/u.test(this.operations), true);
});

Then("公開後に遠隔タグを確認する手順がある", function () {
  assert.deepEqual(
    /git ls-remote[^\n]*refs\/tags/u.test(this.operations),
    true,
  );
});

Then("公開後にGitHub Releaseを確認する手順がある", function () {
  assert.deepEqual(/gh release view/u.test(this.operations), true);
});

Then("公開後に由来証明を確認する手順がある", function () {
  assert.deepEqual(/npm audit signatures/u.test(this.operations), true);
});

Then("外部条件が不足した公開は再試行しないと案内される", function () {
  assert.deepEqual(/再試行しない/u.test(this.operations), true);
});

Then("公開条件の不足を報告する手順がある", function () {
  assert.deepEqual(/不足条件/u.test(this.operations), true);
});
