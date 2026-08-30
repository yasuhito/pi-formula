const assert = require('node:assert/strict');
const { mkdtempSync, readFileSync, rmSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { join, resolve } = require('node:path');
const { spawnSync } = require('node:child_process');
const { After, Given, Then, When } = require('@cucumber/cucumber');

const root = resolve(__dirname, '../..');
const readProjectFile = (path) => readFileSync(join(root, path), 'utf8');

After(function () {
  if (this.releaseDirectory) {
    rmSync(this.releaseDirectory, { recursive: true, force: true });
  }
});

Given('初回 npm 公開の手順がある', function () {
  this.releaseGuide = readProjectFile('docs/releasing.md');
  this.initialPublisher = readProjectFile('scripts/publish-initial.sh');
});

When('1Password から npm 認証情報を渡す方法を調べる', function () {
  this.initialPublishInstructions = `${this.releaseGuide}\n${this.initialPublisher}`;
});

Then('秘密情報を表示もログ保存もせず初回公開できる', function () {
  assert.deepEqual({
    onePassword: /\bop run\b/u.test(this.initialPublishInstructions),
    secretReferences: /OP_NPM_TOKEN_REF/u.test(this.initialPublishInstructions) &&
      /OP_NPM_OTP_REF/u.test(this.initialPublishInstructions),
    noTrace: /set \+x/u.test(this.initialPublisher),
    temporaryNpmrc: /mktemp/u.test(this.initialPublisher) && /trap/u.test(this.initialPublisher),
    noReveal: !/--reveal/u.test(this.initialPublisher)
  }, {
    onePassword: true,
    secretReferences: true,
    noTrace: true,
    temporaryNpmrc: true,
    noReveal: true
  });
});

Given('package.json と異なる版の公開タグがある', function () {
  this.releaseTag = 'v9.9.9';
});

Given('package.json と同じ版の公開タグがある', function () {
  const manifest = JSON.parse(readProjectFile('package.json'));
  this.releaseTag = `v${manifest.version}`;
});

When('公開準備を実行する', function () {
  this.releaseDirectory = mkdtempSync(join(tmpdir(), 'pi-formula-release-'));
  this.preparation = spawnSync(
    process.execPath,
    ['scripts/prepare-release.js', this.releaseTag, this.releaseDirectory],
    { cwd: root, encoding: 'utf8' }
  );
});

Then('公開準備は tarball を作らず失敗する', function () {
  assert.deepEqual({
    status: this.preparation.status,
    mismatch: /does not match package\.json version/u.test(this.preparation.stderr),
    files: require('node:fs').readdirSync(this.releaseDirectory)
  }, { status: 1, mismatch: true, files: [] });
});

Then('全チェック後の tarball と CHANGELOG の箇条書きが公開用に用意される', function () {
  const manifest = JSON.parse(readProjectFile('package.json'));
  const packageScripts = manifest.scripts;
  const files = require('node:fs').readdirSync(this.releaseDirectory).sort();
  assert.deepEqual({
    preparationStatus: this.preparation.status,
    checkBeforePrepare: packageScripts['release:prepare'],
    files,
    workflowUsesCommand: /npm run release:prepare --/u.test(readProjectFile('.github/workflows/release.yml'))
  }, {
    preparationStatus: 0,
    checkBeforePrepare: 'npm run check && node scripts/prepare-release.js',
    files: [`pi-formula-${manifest.version}.tgz`, 'release-notes.md'],
    workflowUsesCommand: true
  }, this.preparation.stderr);
});

Given('npm 公開用の GitHub Actions がある', function () {
  this.releaseWorkflow = readProjectFile('.github/workflows/release.yml');
});

When('公開ジョブの権限と環境を調べる', function () {
  this.publishJob = this.releaseWorkflow;
});

Then('人間の承認、npm の信頼された公開、由来証明が必須になっている', function () {
  assert.deepEqual({
    tagTrigger: /tags:\s*\n\s*- ['"]v\*\.\*\.\*['"]/u.test(this.publishJob),
    approvalEnvironment: /environment:\s*npm/u.test(this.publishJob),
    oidc: /id-token:\s*write/u.test(this.publishJob),
    provenance: /npm publish .*--provenance/u.test(this.publishJob),
    noToken: !/NODE_AUTH_TOKEN|NPM_TOKEN/u.test(this.publishJob)
  }, {
    tagTrigger: true,
    approvalEnvironment: true,
    oidc: true,
    provenance: true,
    noToken: true
  });
});

Then('Release の題名と本文は同じ版の CHANGELOG に一致する', function () {
  assert.equal(this.preparation.status, 0, this.preparation.stderr);
  const manifest = JSON.parse(readProjectFile('package.json'));
  const changelog = readProjectFile('CHANGELOG.md');
  const section = new RegExp(`^## ${manifest.version}[^\\n]*\\n\\n((?:- .+\\n?)+)`, 'mu').exec(changelog);
  const notes = readFileSync(join(this.releaseDirectory, 'release-notes.md'), 'utf8');
  const workflow = readProjectFile('.github/workflows/release.yml');
  assert.deepEqual({
    notes,
    expectedNotes: `${section[1].trimEnd()}\n`,
    title: /--title "pi-formula \$\{VERSION\}"/u.test(workflow),
    notesFile: /--notes-file .*release-notes\.md/u.test(workflow)
  }, {
    notes: `${section[1].trimEnd()}\n`,
    expectedNotes: `${section[1].trimEnd()}\n`,
    title: true,
    notesFile: true
  });
});

Given('継続公開の運用手順がある', function () {
  this.releaseGuide = readProjectFile('docs/releasing.md');
});

When('公開後と公開失敗時の手順を調べる', function () {
  this.operations = this.releaseGuide;
});

Then('npm、タグ、Release、由来証明を確認し外部条件不足では再試行せず報告できる', function () {
  assert.deepEqual({
    npm: /npm view pi-formula/u.test(this.operations),
    tag: /git ls-remote[^\n]*refs\/tags/u.test(this.operations),
    release: /gh release view/u.test(this.operations),
    provenance: /npm audit signatures/u.test(this.operations),
    noRetry: /再試行しない/u.test(this.operations),
    reportMissingCondition: /不足条件/u.test(this.operations)
  }, { npm: true, tag: true, release: true, provenance: true, noRetry: true, reportMissingCondition: true });
});
