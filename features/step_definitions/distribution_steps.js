const assert = require('node:assert/strict');
const { readFileSync, rmSync } = require('node:fs');
const { join, resolve } = require('node:path');
const { spawnSync } = require('node:child_process');
const { Given, Then, When } = require('@cucumber/cucumber');

const root = resolve(__dirname, '../..');
const readProjectFile = (path) => readFileSync(join(root, path), 'utf8');
const readProjectBinary = (path) => readFileSync(join(root, path));

Given('pi-formula の英語と日本語の README がある', function () {
  this.englishReadme = readProjectFile('README.md');
  this.japaneseReadme = readProjectFile('README.ja.md');
});

When('利用者向けの導入、設定、対応範囲を調べる', function () {
  this.readmes = `${this.englishReadme}\n${this.japaneseReadme}`;
});

Then('両言語から導入方法、表示見本、formula コマンド、設定、対応端末、対応 OS、未対応範囲、他の数式拡張との併用注意が分かる', function () {
  const checks = {
    reciprocalLinks: /README\.ja\.md/u.test(this.englishReadme) && /README\.md/u.test(this.japaneseReadme),
    primaryInstall: (this.readmes.match(/pi install npm:pi-formula(?!@)/gu) ?? []).length >= 2,
    preview: (this.readmes.match(/assets\/ghostty-formulas\.png/gu) ?? []).length >= 2,
    command: (this.readmes.match(/\/formula/gu) ?? []).length >= 2,
    config: /PI_FORMULA_MACROS/u.test(this.readmes) && /config\.json/u.test(this.readmes),
    terminals: /Ghostty/u.test(this.readmes) && /Kitty/u.test(this.readmes),
    operatingSystems: /Linux/u.test(this.readmes) && /macOS/u.test(this.readmes),
    unsupported: /not supported/iu.test(this.englishReadme) && /未対応/u.test(this.japaneseReadme),
    coexistence: /other math (?:rendering )?extensions/iu.test(this.englishReadme) && /他の数式拡張/u.test(this.japaneseReadme)
  };
  assert.equal(Object.values(checks).every(Boolean), true, JSON.stringify(checks));
});

Given('pi-formula の Pi パッケージ情報がある', function () {
  this.manifest = JSON.parse(readProjectFile('package.json'));
});

When('画像情報を調べる', function () {
  this.galleryImage = this.manifest.pi?.image;
  this.preview = readProjectBinary('assets/ghostty-formulas.png');
});

Then('Unicode のインライン数式と画像の表示数式を含む Ghostty 表示見本が設定されている', function () {
  assert.deepEqual({
    galleryImage: this.galleryImage,
    pngSignature: this.preview.subarray(1, 4).toString('ascii')
  }, {
    galleryImage: 'https://raw.githubusercontent.com/yasuhito/pi-formula/main/assets/ghostty-formulas.png',
    pngSignature: 'PNG'
  });
});

Given('pi-formula の npm tarball を作る', function () {
  const packed = spawnSync('npm', ['pack', '--json'], { cwd: root, encoding: 'utf8' });
  assert.equal(packed.status, 0, packed.stderr);
  const output = JSON.parse(packed.stdout);
  this.packResult = Array.isArray(output) ? output[0] : output['pi-formula'];
  this.tarball = join(root, this.packResult.filename);
});

When('tarball のファイル一覧を調べる', function () {
  this.packedFiles = this.packResult.files.map(({ path }) => path).sort();
  rmSync(this.tarball, { force: true });
});

Then('src、dist、両言語の README、LICENSE、CHANGELOG、第三者部品情報、表示見本だけが配布される', function () {
  const topLevel = [...new Set(this.packedFiles.map((path) => path.split('/')[0]))].sort();
  assert.deepEqual(topLevel, [
    'CHANGELOG.md',
    'LICENSE',
    'README.ja.md',
    'README.md',
    'THIRD_PARTY_NOTICES.md',
    'assets',
    'dist',
    'package.json',
    'src'
  ]);
  assert.equal(this.packedFiles.includes('assets/ghostty-formulas.png'), true);
});

Given('pi-formula のライセンスと第三者部品情報がある', function () {
  this.license = readProjectFile('LICENSE');
  this.notices = readProjectFile('THIRD_PARTY_NOTICES.md');
  this.manifest = JSON.parse(readProjectFile('package.json'));
});

When('由来、版、更新状況、ライセンス、既知の脆弱性を調べる', function () {
  this.directDependencies = Object.keys(this.manifest.dependencies);
});

Then('MIT License、取り込み元、すべての直接依存の監査結果と確認日が分かる', function () {
  const auditedDependencies = this.directDependencies.every((name) =>
    this.notices.includes(name) && /最新|current/iu.test(this.notices) && /脆弱|vulnerabilit/iu.test(this.notices)
  );
  assert.deepEqual({
    mitLicense: this.license.startsWith('MIT License'),
    provenance: this.notices.includes('yasuhito/qni-cli') && this.notices.includes('2f12594e80b9e7baff0c85ecfecb4dd34d06f737'),
    auditDate: /2026-08-31/u.test(this.notices),
    auditedDependencies
  }, { mitLicense: true, provenance: true, auditDate: true, auditedDependencies: true });
});
