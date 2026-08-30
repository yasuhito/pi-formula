const assert = require('node:assert/strict');
const { mkdtempSync, readFileSync, rmSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { join, resolve } = require('node:path');
const { spawnSync } = require('node:child_process');
const { After, Given, Then, When } = require('@cucumber/cucumber');
const { extractReleaseNotes } = require('../../scripts/release-notes');

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

Given('初回版が 1Password で npm に公開済みである', function () {
  this.releaseGuide = readProjectFile('docs/releasing.md');
  this.releaseWorkflow = readProjectFile('.github/workflows/release.yml');
});

When('初回版の遠隔タグと Release を作る経路を調べる', function () {
  this.initialReleaseJob = this.releaseWorkflow.slice(
    this.releaseWorkflow.indexOf('\n  initial-release:')
  );
});

Then('タグ push 用の公開処理と競合せず初回版を完了できる', function () {
  const npmCheck = this.initialReleaseJob.indexOf('npm view');
  const tagCreation = this.initialReleaseJob.indexOf('git/refs');
  assert.deepEqual({
    manualTrigger: /workflow_dispatch:/u.test(this.releaseWorkflow),
    initialJobOnly: /if: github\.event_name == 'workflow_dispatch'/u.test(this.initialReleaseJob),
    tagJobsOnlyOnPush: (this.releaseWorkflow.match(/if: github\.event_name == 'push'/gu) ?? []).length,
    npmCheckedBeforeTag: npmCheck !== -1 && npmCheck < tagCreation,
    exactTarballChecked: /dist\.integrity/u.test(this.initialReleaseJob) && /LOCAL_INTEGRITY/u.test(this.initialReleaseJob),
    createsTag: /refs\/tags\/\$\{RELEASE_TAG\}/u.test(this.initialReleaseJob),
    createsRelease: /gh release create "\$\{RELEASE_TAG\}"/u.test(this.initialReleaseJob),
    releaseTitle: /--title "pi-formula \$\{VERSION\}"/u.test(this.initialReleaseJob),
    releaseNotes: /--notes-file \.release\/release-notes\.md/u.test(this.initialReleaseJob),
    noRepublish: !/npm publish/u.test(this.initialReleaseJob),
    tokenDoesNotRetrigger: /GITHUB_TOKEN[^\n]*タグ push 用の公開処理は新しく起動せず/u.test(this.releaseGuide),
    initialProvenanceException: /初回版[^。]*由来証明は付かない/u.test(this.releaseGuide)
  }, {
    manualTrigger: true,
    initialJobOnly: true,
    tagJobsOnlyOnPush: 2,
    npmCheckedBeforeTag: true,
    exactTarballChecked: true,
    createsTag: true,
    createsRelease: true,
    releaseTitle: true,
    releaseNotes: true,
    noRepublish: true,
    tokenDoesNotRetrigger: true,
    initialProvenanceException: true
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
  this.releaseGuide = readProjectFile('docs/releasing.md');
});

When('公開ジョブの権限と環境を調べる', function () {
  this.publishJob = this.releaseWorkflow;
});

Then('人間の承認、npm の信頼された公開、由来証明が必須になっている', function () {
  assert.deepEqual({
    tagTrigger: /tags:\s*\n\s*- ['"]v\*\.\*\.\*['"]/u.test(this.publishJob),
    approvalEnvironment: /environment:\s*npm/u.test(this.publishJob),
    allowedAction: /Allowed actions: `npm publish`/u.test(this.releaseGuide),
    oidc: /id-token:\s*write/u.test(this.publishJob),
    provenance: /npm publish .*--provenance/u.test(this.publishJob),
    noToken: !/NODE_AUTH_TOKEN|NPM_TOKEN/u.test(this.publishJob)
  }, {
    tagTrigger: true,
    approvalEnvironment: true,
    allowedAction: true,
    oidc: true,
    provenance: true,
    noToken: true
  });
});

Then('Release の題名と本文は同じ版の CHANGELOG に一致する', function () {
  assert.equal(this.preparation.status, 0, this.preparation.stderr);
  const manifest = JSON.parse(readProjectFile('package.json'));
  const changelogLines = readProjectFile('CHANGELOG.md').split('\n');
  const headingIndex = changelogLines.findIndex((line) =>
    line === `## ${manifest.version}` || line.startsWith(`## ${manifest.version} `)
  );
  const bulletLines = changelogLines.slice(headingIndex + 2);
  const firstNonBullet = bulletLines.findIndex((line) => !line.startsWith('- '));
  const bulletEnd = firstNonBullet === -1 ? bulletLines.length : firstNonBullet;
  const expectedNotes = `${bulletLines.slice(0, bulletEnd).join('\n')}\n`;
  const notes = readFileSync(join(this.releaseDirectory, 'release-notes.md'), 'utf8');
  const workflow = readProjectFile('.github/workflows/release.yml');
  assert.deepEqual({
    notes,
    title: /--title "pi-formula \$\{VERSION\}"/u.test(workflow),
    notesFile: /--notes-file .*release-notes\.md/u.test(workflow)
  }, {
    notes: expectedNotes,
    title: true,
    notesFile: true
  });
});

Given('CHANGELOG に現在の版から始まる別の版だけがある', function () {
  this.similarVersionChangelog = [
    '## 0.1.00 - Unreleased',
    '',
    '- Wrong numeric version.',
    '',
    '## 0.1.0x - Unreleased',
    '',
    '- Wrong suffix version.',
    ''
  ].join('\n');
});

When('現在の版の Release 本文を取り出す', function () {
  this.releaseNotes = extractReleaseNotes(this.similarVersionChangelog, '0.1.0');
});

Then('現在の版の Release 本文は見つからない', function () {
  assert.equal(this.releaseNotes, null);
});

Given('CHANGELOG に継続行を持つ箇条書きと次の箇条書きがある', function () {
  this.changelog = [
    '## 0.1.0 - Unreleased',
    '',
    '- First change',
    '  continues on the next line.',
    '',
    '- Second change',
    '  also continues.',
    '',
    '## 0.2.0 - Unreleased',
    '',
    '- Later release.',
    ''
  ].join('\n');
  this.changelogVersion = '0.1.0';
});

Given('CHANGELOG の版に空の箇条書きしかない', function () {
  this.changelog = '## 0.1.0 - Unreleased\n\n- \n';
  this.changelogVersion = '0.1.0';
});

When('その版の Release 本文を取り出す', function () {
  this.releaseNotes = extractReleaseNotes(this.changelog, this.changelogVersion);
});

Then('継続行と次の箇条書きが同じ順で保持される', function () {
  assert.equal(this.releaseNotes, [
    '- First change',
    '  continues on the next line.',
    '',
    '- Second change',
    '  also continues.',
    ''
  ].join('\n'));
});

Then('Release 本文は見つからない', function () {
  assert.equal(this.releaseNotes, null);
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
