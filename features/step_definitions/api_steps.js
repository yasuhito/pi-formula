const assert = require('node:assert/strict');
const { mkdirSync, rmSync, writeFileSync } = require('node:fs');
const { mkdtempSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { join } = require('node:path');
const { After, Before, Given, Then, When } = require('@cucumber/cucumber');

const { fakePi, startWithKitty, startWithText } = require('../../test/support/fake-pi');
const {
  additionalMacros,
  registerIntegrationExtension
} = require('../../test/support/integration-extension');

const apiPath = require.resolve('../..');

function freshApi() {
  delete require.cache[apiPath];
  return require(apiPath);
}

function writeConfig(world, macros) {
  const directory = join(world.xdg, 'pi-formula');
  mkdirSync(directory, { recursive: true });
  writeFileSync(join(directory, 'config.json'), JSON.stringify({ macros }));
}

async function registeredImageApi(world, additional = {}) {
  const formula = freshApi();
  world.pi = fakePi();
  formula.registerFormula(world.pi.api, additional);
  await startWithKitty(world.pi);
  world.formula = formula;
}

Before(function () {
  this.originalEnvironment = {
    XDG_CONFIG_HOME: process.env.XDG_CONFIG_HOME,
    PI_FORMULA_MACROS: process.env.PI_FORMULA_MACROS
  };
  this.xdg = mkdtempSync(join(tmpdir(), 'pi-formula-cucumber-'));
  process.env.XDG_CONFIG_HOME = this.xdg;
  delete process.env.PI_FORMULA_MACROS;
});

After(function () {
  for (const [name, value] of Object.entries(this.originalEnvironment)) {
    if (value === undefined) delete process.env[name];
    else process.env[name] = value;
  }
  rmSync(this.xdg, { recursive: true, force: true });
});

Given('XDG 設定と環境変数に異なる利用者マクロがある', function () {
  writeConfig(this, { configured: 'x' });
  process.env.PI_FORMULA_MACROS = JSON.stringify({ temporary: 'y' });
});

When('両方の利用者マクロを使う PNG を公開 API で作る', async function () {
  await registeredImageApi(this);
  this.image = this.formula.createFormulaPng(
    this.pi.api, '\\configured+\\temporary', 80
  );
});

Then('XDG 設定と環境変数の利用者マクロが一緒に使える', function () {
  assert.equal(Buffer.isBuffer(this.image?.data), true);
});

Given('XDG 設定と環境変数に同名の利用者マクロがある', function () {
  writeConfig(this, { chosen: 'y' });
  process.env.PI_FORMULA_MACROS = JSON.stringify({ chosen: 'x' });
});

When('同名の利用者マクロを使う PNG を公開 API で作る', async function () {
  await registeredImageApi(this);
  this.image = this.formula.createFormulaPng(this.pi.api, '\\chosen', 80);
  this.expectedImage = this.formula.createFormulaPng(this.pi.api, 'x', 80);
});

Then('環境変数の利用者マクロで PNG が作られる', function () {
  assert.deepEqual(this.image?.data, this.expectedImage?.data);
});

Given('正しい定義と壊れた定義を含む利用者マクロ設定がある', function () {
  writeConfig(this, { usable: 'x', broken: ['#2', 1] });
});

When('正しい利用者マクロと壊れた利用者マクロから PNG を作る', async function () {
  await registeredImageApi(this);
  this.usableImage = this.formula.createFormulaPng(this.pi.api, '\\usable', 80);
  this.brokenImage = this.formula.createFormulaPng(this.pi.api, '\\broken{x}', 80);
});

Then('正しい利用者マクロだけが使える', function () {
  assert.deepEqual({
    usable: Buffer.isBuffer(this.usableImage?.data),
    broken: this.brokenImage
  }, { usable: true, broken: undefined });
});

Given('正しい XDG 設定と壊れた JSON の環境変数がある', function () {
  writeConfig(this, { configured: 'x' });
  process.env.PI_FORMULA_MACROS = '{';
});

When('XDG 設定の利用者マクロを使う PNG を公開 API で作る', async function () {
  await registeredImageApi(this);
  this.image = this.formula.createFormulaPng(this.pi.api, '\\configured', 80);
});

Then('壊れた環境変数に関係なく XDG 設定の利用者マクロが使える', function () {
  assert.equal(Buffer.isBuffer(this.image?.data), true);
});

Given('試験用の連携拡張と同名の利用者マクロがある', function () {
  writeConfig(this, { trial: 'wrong' });
});

When('連携拡張の追加マクロを使う PNG を公開 API で作る', async function () {
  await registeredImageApi(this);
  this.integration = registerIntegrationExtension(this.pi.api);
  this.image = this.integration.createPng('\\trial{x}');
  this.expectedImage = this.formula.createFormulaPng(
    this.pi.api, '\\left|x\\right\\rangle', 80
  );
});

Then('利用者設定では追加マクロを上書きできない', function () {
  assert.deepEqual(this.image?.data, this.expectedImage?.data);
});

Given('pi-formula の CommonJS 公開 API がある', function () {
  this.formula = freshApi();
});

When('公開された名前を調べる', function () {
  this.publicNames = Object.keys(this.formula).sort();
});

Then('拡張登録と同期的な PNG 作成だけが公開される', function () {
  assert.deepEqual(this.publicNames, ['createFormulaPng', 'registerFormula']);
});

Given('画像経路を使う試験用の連携拡張がある', async function () {
  this.pi = fakePi();
  this.integration = registerIntegrationExtension(this.pi.api);
  await startWithKitty(this.pi);
});

When('連携拡張が公開 API で PNG を作る', function () {
  this.image = this.integration.createPng('\\trial{x}');
});

Then('PNG データと大きさが画面部品なしで返る', function () {
  assert.deepEqual({
    keys: Object.keys(this.image ?? {}).sort(),
    png: this.image?.data.subarray(1, 4).toString('ascii'),
    positiveSize: (this.image?.widthPx ?? 0) > 0 && (this.image?.heightPx ?? 0) > 0
  }, {
    keys: ['columns', 'data', 'heightPx', 'rows', 'widthPx'],
    png: 'PNG',
    positiveSize: true
  });
});

Given('テキスト経路を使う試験用の連携拡張がある', async function () {
  this.pi = fakePi();
  this.integration = registerIntegrationExtension(this.pi.api);
  await startWithText(this.pi);
});

Then('公開 API は画像を返さない', function () {
  assert.equal(this.image, undefined);
});

async function loadBoth(world, bundledFirst) {
  const standalone = freshApi();
  const bundled = freshApi();
  world.pi = fakePi();
  if (bundledFirst) {
    bundled.registerFormula(world.pi.api, additionalMacros);
    standalone.registerFormula(world.pi.api);
  } else {
    standalone.registerFormula(world.pi.api);
    bundled.registerFormula(world.pi.api, additionalMacros);
  }
  await startWithKitty(world.pi);
  world.counts = world.pi.registrationCounts();
  world.integrationImage = bundled.createFormulaPng(world.pi.api, '\\trial{x}', 80);
}

Given('単体版を同梱版より先に読み込む', async function () {
  await loadBoth(this, false);
});

Given('同梱版を単体版より先に読み込む', async function () {
  await loadBoth(this, true);
});

When('両方の拡張登録を調べる', function () {
  this.result = { ...this.counts, additionalMacro: Buffer.isBuffer(this.integrationImage?.data) };
});

Then('数式描画と formula コマンドは一つになる', function () {
  assert.deepEqual(this.result, {
    transformerRegistrations: 1,
    commandRegistrations: 1,
    additionalMacro: true
  });
});
