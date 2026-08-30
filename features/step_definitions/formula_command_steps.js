const assert = require('node:assert/strict');
const { existsSync, readFileSync } = require('node:fs');
const { mkdtempSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { join } = require('node:path');
const { Given, Then, When } = require('@cucumber/cucumber');

const registerFormula = require('../../dist/extension.js').default;
const { fakePi, startSession } = require('../../test/support/fake-pi');

function withEnvironment(changes, run) {
  const original = {};
  for (const [name, value] of Object.entries(changes)) {
    original[name] = process.env[name];
    if (value === undefined) delete process.env[name];
    else process.env[name] = value;
  }
  return Promise.resolve(run()).finally(() => {
    for (const [name, value] of Object.entries(original)) {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
  });
}

async function statusLines(pi, started) {
  await pi.commands.get('formula').handler('status', started.ctx);
  return started.widgets.get('pi-formula-status');
}

Given('{word} が PNG 問い合わせへ応答する Pi がある', function (terminal) {
  this.terminal = terminal;
  this.startOptions = { response: 'OK' };
  this.pi = fakePi();
  registerFormula(this.pi.api);
});

When('セッションを開始する', async function () {
  this.started = await withEnvironment({
    TERM_PROGRAM: this.terminal,
    TERM: this.term,
    TMUX: this.tmux
  }, () => startSession(this.pi, this.startOptions));
});

Then('画像経路が選ばれる', async function () {
  assert.equal((await statusLines(this.pi, this.started)).includes('path: image'), true);
});

Given('画像を使えない端末環境がある', function () {
  this.fallbacks = [];
});

When('各環境でセッションを開始する', async function () {
  const cases = [
    { env: { TMUX: '1', TERM: 'xterm-kitty' }, options: { response: 'OK' } },
    { env: { TMUX: undefined, TERM: 'screen-256color' }, options: { response: 'OK' } },
    { env: { TMUX: undefined, TERM: 'xterm-kitty' }, options: { response: 'EINVAL' } },
    { env: { TMUX: undefined, TERM: 'xterm-kitty' }, options: {} },
    { env: { TMUX: undefined, TERM: 'xterm-kitty' }, options: { mode: 'rpc' } }
  ];
  for (const item of cases) {
    const pi = fakePi();
    registerFormula(pi.api);
    const started = await withEnvironment(item.env, () => startSession(pi, item.options));
    this.fallbacks.push(await statusLines(pi, started));
  }
});

Then('すべての環境でテキスト経路が選ばれる', function () {
  assert.equal(this.fallbacks.every((lines) => lines.includes('path: text')), true);
});

When('formula コマンドの image と text と auto を順に実行する', async function () {
  this.started = await startSession(this.pi, { response: 'OK' });
  this.selectedPaths = [];
  for (const action of ['image', 'text', 'auto']) {
    await this.pi.commands.get('formula').handler(action, this.started.ctx);
    const lines = await statusLines(this.pi, this.started);
    this.selectedPaths.push(lines.find((line) => line.startsWith('path:')));
  }
});

Then('経路が切り替わり、すべての指定が現在のセッションへ保存される', function () {
  assert.deepEqual({
    selectedPaths: this.selectedPaths,
    savedPaths: this.pi.entries.map((entry) => entry.data.path)
  }, {
    selectedPaths: ['path: image', 'path: text', 'path: image'],
    savedPaths: ['image', 'text', 'auto']
  });
});

Given('一時的な XDG 設定を使う Pi がある', function () {
  this.xdg = mkdtempSync(join(tmpdir(), 'pi-formula-xdg-'));
});

When('default なしとありの表示経路指定を実行してから auto default を実行する', async function () {
  await withEnvironment({ XDG_CONFIG_HOME: this.xdg }, async () => {
    const pi = fakePi();
    registerFormula(pi.api);
    const started = await startSession(pi, { response: 'OK' });
    const command = pi.commands.get('formula');
    await command.handler('text', started.ctx);
    this.existsAfterSessionOnly = existsSync(join(this.xdg, 'pi-formula', 'config.json'));
    await command.handler('image --default', started.ctx);
    this.savedDefault = JSON.parse(readFileSync(join(this.xdg, 'pi-formula', 'config.json'))).path;
    await command.handler('auto --default', started.ctx);
    this.existsAfterAuto = existsSync(join(this.xdg, 'pi-formula', 'config.json'));
  });
});

Then('default 指定だけが XDG 設定を変更する', function () {
  assert.deepEqual({
    existsAfterSessionOnly: this.existsAfterSessionOnly,
    savedDefault: this.savedDefault,
    existsAfterAuto: this.existsAfterAuto
  }, { existsAfterSessionOnly: false, savedDefault: 'image', existsAfterAuto: false });
});

Given('画像の一時保存がある Pi がある', async function () {
  this.pi = fakePi();
  registerFormula(this.pi.api);
  this.started = await startSession(this.pi, { response: 'OK' });
  this.pi.transformer()('$$x$$', {
    messageType: 'assistant', isStreaming: false, availableWidth: 80
  });
});

When('formula clear を実行する', async function () {
  await this.pi.commands.get('formula').handler('clear', this.started.ctx);
});

Then('画像の一時保存が空になる', async function () {
  assert.equal((await statusLines(this.pi, this.started)).includes('cache: 0 entries, 0 bytes'), true);
});

Given('秘密のマクロ設定がある Kitty の Pi がある', async function () {
  this.pi = fakePi();
  registerFormula(this.pi.api);
  this.started = await withEnvironment({
    TERM_PROGRAM: 'kitty',
    PI_FORMULA_MACROS: '{"secret":"do-not-show-this"}'
  }, () => startSession(this.pi, { response: 'OK' }));
});

When('formula status を実行する', async function () {
  this.lines = await statusLines(this.pi, this.started);
});

Then('版、経路、理由、端末、マクロ数、一時保存、直近の失敗だけを英語表示する', function () {
  assert.deepEqual({
    fields: this.lines.map((line) => line.split(':')[0]),
    english: this.lines.every((line) => /^[\x20-\x7e]+$/u.test(line)),
    macroCount: this.lines.includes('macros: 1'),
    leaksSecret: this.lines.join('\n').includes('do-not-show-this')
  }, {
    fields: ['pi-formula 0.1.0', 'path', 'reason', 'terminal', 'macros', 'cache', 'last failure'],
    english: true,
    macroCount: true,
    leaksSecret: false
  });
});

Given('画面のない Pi がある', function () {
  this.pi = fakePi();
  registerFormula(this.pi.api);
  this.startOptions = { mode: 'rpc', response: 'OK' };
});

Then('待機せず制御文字も端末へ出さない', function () {
  assert.equal(this.started.terminalWrites, 0);
});
