const assert = require('node:assert/strict');
const { readFileSync, rmSync } = require('node:fs');
const { join, resolve } = require('node:path');
const { spawnSync } = require('node:child_process');
const { createHash } = require('node:crypto');
const { Given, Then, When } = require('@cucumber/cucumber');

const root = resolve(__dirname, '../..');
const readProjectFile = (path) => readFileSync(join(root, path), 'utf8');
const readProjectBinary = (path) => readFileSync(join(root, path));

Given('pi-formula の英語と日本語の README がある', function () {
  this.englishReadme = readProjectFile('README.md');
  this.japaneseReadme = readProjectFile('README.ja.md');
});

When('利用者向けの導入、設定、対応範囲を調べる', function () {
  this.readmes = {
    english: this.englishReadme,
    japanese: this.japaneseReadme
  };
});

Then('両言語から導入方法、表示見本、formula コマンド、設定、対応端末、対応 OS、未対応範囲、他の数式拡張との併用注意が分かる', function () {
  const sharedChecks = (readme) => ({
    primaryInstall: /pi install npm:pi-formula(?!@)/u.test(readme),
    preview: /assets\/ghostty-formulas\.png/u.test(readme),
    command: /\/formula/u.test(readme),
    config: /PI_FORMULA_MACROS/u.test(readme) && /config\.json/u.test(readme),
    terminals: /Ghostty/u.test(readme) && /Kitty/u.test(readme),
    operatingSystems: /Linux/u.test(readme) && /macOS/u.test(readme)
  });
  const checks = {
    reciprocalLinks: /README\.ja\.md/u.test(this.englishReadme) && /README\.md/u.test(this.japaneseReadme),
    english: {
      ...sharedChecks(this.readmes.english),
      unsupported: /not supported/iu.test(this.readmes.english),
      coexistence: /other math (?:rendering )?extensions/iu.test(this.readmes.english)
    },
    japanese: {
      ...sharedChecks(this.readmes.japanese),
      unsupported: /未対応/u.test(this.readmes.japanese),
      coexistence: /他の数式拡張/u.test(this.readmes.japanese)
    }
  };
  assert.equal(
    checks.reciprocalLinks && Object.values(checks.english).every(Boolean) &&
      Object.values(checks.japanese).every(Boolean),
    true,
    JSON.stringify(checks)
  );
});

Given('pi-formula の Pi パッケージ情報がある', function () {
  this.manifest = JSON.parse(readProjectFile('package.json'));
});

When('画像情報を調べる', function () {
  this.galleryImage = this.manifest.pi?.image;
  this.preview = readProjectBinary('assets/ghostty-formulas.png');
});

Then('Unicode のインライン数式と画像の表示数式を含む Ghostty 表示見本が設定されている', function () {
  // Update these fixed values only after visually approving a replacement Ghostty preview.
  assert.deepEqual({
    galleryImage: this.galleryImage,
    pngSignature: this.preview.subarray(1, 4).toString('ascii'),
    width: this.preview.readUInt32BE(16),
    height: this.preview.readUInt32BE(20),
    sha256: createHash('sha256').update(this.preview).digest('hex')
  }, {
    galleryImage: 'https://raw.githubusercontent.com/yasuhito/pi-formula/main/assets/ghostty-formulas.png',
    pngSignature: 'PNG',
    width: 992,
    height: 1044,
    sha256: '2c6f7b3eec959b6278f4ac7682b08c69787b2cb6961d283a553ce7d0204d854d'
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
  this.directDependencies = {
    ...this.manifest.dependencies,
    ...this.manifest.peerDependencies
  };
  this.auditRows = new Map(this.notices.split('\n')
    .filter((line) => line.startsWith('| [`@'))
    .map((line) => {
      const cells = line.split('|').slice(1, -1).map((cell) => cell.trim());
      const name = /`([^`]+)`/u.exec(cells[0])?.[1];
      return [name, cells];
    }));
});

Then('MIT License、取り込み元、すべての直接依存の監査結果と確認日が分かる', function () {
  const expectedRows = {
    '@mathjax/src': ['`^4.1.3` (lockfile: `4.1.3`)', '`4.1.3`', '2026-07-03', 'Current', 'Apache-2.0', 'None (`npm audit`)'],
    '@resvg/resvg-js': ['`^2.6.2` (lockfile: `2.6.2`)', '`2.6.2`', '2024-03-26', 'Current stable; next `2.7.0-alpha.2` (2026-01-28)', 'MPL-2.0', 'None (`npm audit`)'],
    '@earendil-works/pi-coding-agent': ['`*` (verified: `0.84.4`)', '`0.84.4`', '2026-08-28', 'Current', 'MIT', 'None (`npm audit`)'],
    '@earendil-works/pi-tui': ['`*` (verified: `0.84.4`)', '`0.84.4`', '2026-08-28', 'Current', 'MIT', 'None (`npm audit`)']
  };
  const auditedRows = Object.fromEntries(Object.keys(expectedRows).map((name) => [
    name,
    this.auditRows.get(name)?.slice(1)
  ]));
  assert.deepEqual({
    mitLicense: this.license.startsWith('MIT License'),
    provenance: this.notices.includes('yasuhito/qni-cli') && this.notices.includes('2f12594e80b9e7baff0c85ecfecb4dd34d06f737'),
    auditDate: /2026-08-31/u.test(this.notices),
    directDependencyNames: Object.keys(this.directDependencies).sort(),
    auditedNames: [...this.auditRows.keys()].sort(),
    auditedRows
  }, {
    mitLicense: true,
    provenance: true,
    auditDate: true,
    directDependencyNames: Object.keys(expectedRows).sort(),
    auditedNames: Object.keys(expectedRows).sort(),
    auditedRows: expectedRows
  });
});
