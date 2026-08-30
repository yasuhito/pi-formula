const assert = require('node:assert/strict');
const childProcess = require('node:child_process');
const fs = require('node:fs');
const http = require('node:http');
const https = require('node:https');
const net = require('node:net');
const { resolve } = require('node:path');
const { performance } = require('node:perf_hooks');
const { Given, Then, When } = require('@cucumber/cucumber');

const registerFormula = require('../../dist/extension.js').default;
const { fakePi, startWithKitty } = require('../../test/support/fake-pi');
const PLACEHOLDER = String.fromCodePoint(0x10eeee);

function transform(world, markdown, options = {}) {
  world.source = markdown;
  world.rendered = world.pi.transformer()(markdown, {
    messageType: options.messageType ?? 'assistant',
    isStreaming: options.isStreaming ?? false,
    availableWidth: 80
  });
}

function placeholderLines(markdown) {
  return markdown.split('\n').filter((line) => line.includes(PLACEHOLDER));
}

function imageCount(markdown) {
  return (markdown.match(/\x1b_Ga=T,f=100/gu) ?? []).length;
}

Given('画像経路で数式を描ける Pi がある', async function () {
  this.pi = fakePi();
  registerFormula(this.pi.api);
  await startWithKitty(this.pi);
});

When('4 種類の数式区切りを含む本文を変換する', function () {
  transform(this, '$x$ と $$y$$ と \\(z\\) と \\[w\\]');
});

When('コードフェンスと文中コードに数式がある本文を変換する', function () {
  transform(this, [
    '```text', '$$fenced$$', '```', '`$$inline$$`',
    '- ```text', '  $$listed$$', '  ```'
  ].join('\n'));
});

When('thinking の本文を変換する', function () {
  transform(this, '考える: $$x$$', { messageType: 'assistant-thinking' });
});

When('金額と URL とシェル変数とエスケープ済みドル記号を含む本文を変換する', function () {
  transform(this, [
    'It costs $5 or $10. https://example.com/$5 uses $HOME and \\$5.',
    'Keep https://example.com/$$x$$/page and run echo $$; kill $$ safely.'
  ].join('\n'));
});

When('曖昧なドル記号を含む本文を変換する', function () {
  transform(this, 'The values are $first and $second, not a formula.');
});

When('箇条書き内の表示数式を変換する', function () {
  transform(this, '- 外側\n  - 式: $$\n    x^2\n    $$');
});

When('引用内の表示数式を変換する', function () {
  transform(this, '> 式: \\[\n> x^2\n> \\]');
});

When('閉じた数式まで届いたストリーミング本文を変換する', function () {
  transform(this, '途中\n$$x$$\n続き', { isStreaming: true });
});

When('未完成な数式まで届いたストリーミング本文を変換する', function () {
  transform(this, '途中\n$$\\frac{1}{2}', { isStreaming: true });
});

When('不正な表示数式と正しい表示数式を含む本文を変換する', function () {
  transform(this, '$$\\notacommand{$$\n次の本文\n$$x$$');
});

Then('インライン数式は残り、2 つの表示数式だけが画像になる', function () {
  assert.deepEqual({
    inlineDollar: this.rendered.includes('$x$'),
    inlineParentheses: this.rendered.includes('\\(z\\)'),
    imageCount: imageCount(this.rendered)
  }, { inlineDollar: true, inlineParentheses: true, imageCount: 2 });
});

Then('コード内の本文は変更されない', function () {
  assert.equal(this.rendered, this.source);
});

Then('thinking の本文は変更されない', function () {
  assert.equal(this.rendered, this.source);
});

Then('通常のドル記号を含む本文は変更されない', function () {
  assert.equal(this.rendered, this.source);
});

Then('曖昧なドル記号を含む本文は変更されない', function () {
  assert.equal(this.rendered, this.source);
});

Then('画像は箇条書きの字下げに残る', function () {
  assert.equal(placeholderLines(this.rendered)[0]?.startsWith('    '), true);
});

Then('画像は引用の階層に残る', function () {
  assert.equal(placeholderLines(this.rendered)[0]?.startsWith('> '), true);
});

Then('閉じた表示数式は画像になる', function () {
  assert.equal(placeholderLines(this.rendered).length, 1);
});

Then('未完成な数式は原文のまま残る', function () {
  assert.equal(this.rendered, this.source);
});

Then('不正な数式は残り、正しい数式だけが画像になる', function () {
  assert.deepEqual({
    invalidRemains: this.rendered.includes('$$\\notacommand{$$'),
    followingTextRemains: this.rendered.includes('次の本文'),
    imageCount: imageCount(this.rendered)
  }, { invalidRemains: true, followingTextRemains: true, imageCount: 1 });
});

Given('pi-formula の画像処理設定を読む', function () {
  this.safetyLimits = require('../../dist/typesetter.js').FORMULA_SAFETY_LIMITS;
});

When('固定上限を確認する', function () {
  this.limitValues = Object.values(this.safetyLimits ?? {});
});

Then('入力文字数、画像列数・行数、一時保存件数・バイト数が有限の正数である', function () {
  assert.deepEqual({
    names: Object.keys(this.safetyLimits ?? {}).sort(),
    allFinitePositiveIntegers: this.limitValues.every(
      (value) => Number.isSafeInteger(value) && value > 0
    )
  }, {
    names: ['cacheBytes', 'cacheEntries', 'imageColumns', 'imageRows', 'latexCharacters'],
    allFinitePositiveIntegers: true
  });
});

When('上限を超えた表示数式と正しい表示数式を変換する', function () {
  const max = require('../../dist/typesetter.js').FORMULA_SAFETY_LIMITS.latexCharacters;
  this.oversizedLatex = `x${' '.repeat(max)}`;
  this.tooTallLatex = `\\begin{aligned}${Array.from(
    { length: 200 }, (_, index) => `x_{${index}}`
  ).join('\\\\')}\\end{aligned}`;
  transform(this, `$$${this.oversizedLatex}$$\n$$${this.tooTallLatex}$$\n$$x+7$$`);
});

Then('上限を超えた数式は残り、正しい数式だけが画像になる', function () {
  assert.deepEqual({
    oversizedRemains: this.rendered.includes(this.oversizedLatex),
    tooTallRemains: this.rendered.includes(this.tooTallLatex),
    imageCount: imageCount(this.rendered)
  }, { oversizedRemains: true, tooTallRemains: true, imageCount: 1 });
});

When('基準の半分より小さくなる表示数式と正しい表示数式を変換する', function () {
  this.smallLatex = Array.from({ length: 80 }, (_, index) => `x_{${index}}`).join('+');
  this.source = `$$${this.smallLatex}$$\n$$y+7$$`;
  this.rendered = this.pi.transformer()(this.source, {
    messageType: 'assistant', isStreaming: false, availableWidth: 8
  });
});

Then('小さくなりすぎる数式は残り、正しい数式だけが画像になる', function () {
  assert.deepEqual({
    smallRemains: this.rendered.includes(this.smallLatex),
    imageCount: imageCount(this.rendered)
  }, { smallRemains: true, imageCount: 1 });
});

When('同じ表示数式を異なるテーマ色と表示幅で変換する', async function () {
  const formula = '$$x_{theme-width}$$';
  const first = this.pi.transformer()(formula, {
    messageType: 'assistant', isStreaming: false, availableWidth: 80
  });
  const otherPi = fakePi();
  registerFormula(otherPi.api);
  await startWithKitty(otherPi, { foregroundAnsi: '\x1b[38;2;10;20;30m' });
  const second = otherPi.transformer()(formula, {
    messageType: 'assistant', isStreaming: false, availableWidth: 40
  });
  this.imageIdentities = [first, second].map((rendered) =>
    /\bi=(\d+)/u.exec(rendered)?.[1]
  );
});

Then('テーマ色と表示幅ごとに異なる画像になる', function () {
  assert.equal(
    this.imageIdentities.every(Boolean) && new Set(this.imageIdentities).size === 2,
    true
  );
});

Given('正確な RGB を返さない画像経路の Pi がある', async function () {
  this.pi = fakePi();
  registerFormula(this.pi.api);
  await startWithKitty(this.pi, { foregroundAnsi: '\x1b[38;5;250m' });
});

When('表示数式を変換する', function () {
  transform(this, '$$x_{rgb}$$');
});

Then('RGB を得られない数式は原文のまま残る', function () {
  assert.equal(this.rendered, this.source);
});

When('同じ不正な表示数式を二回変換する', function () {
  const markdown = '$$\\notacommand{cache-failure}$$';
  transform(this, markdown);
  const started = performance.now();
  transform(this, markdown);
  this.failedCacheDuration = performance.now() - started;
});

Then('二回目の失敗結果は5ミリ秒未満で返る', function () {
  assert.ok(this.failedCacheDuration < 5, `cached failure took ${this.failedCacheDuration}ms`);
});

When('外部作用を監視しながら表示数式を変換する', function () {
  const calls = [];
  const patches = [];
  const block = (owner, name, kind) => {
    const original = owner[name];
    patches.push(() => { owner[name] = original; });
    owner[name] = (...args) => {
      calls.push(kind);
      throw new Error(`${kind} is unavailable while rendering`);
    };
  };
  for (const name of ['writeFileSync', 'writeFile', 'appendFileSync', 'appendFile', 'createWriteStream']) {
    block(fs, name, 'disk');
  }
  for (const [owner, names] of [
    [net, ['connect', 'createConnection']],
    [http, ['request', 'get']],
    [https, ['request', 'get']]
  ]) {
    for (const name of names) block(owner, name, 'network');
  }
  for (const name of ['spawn', 'spawnSync', 'exec', 'execSync', 'fork']) {
    block(childProcess, name, 'child process');
  }
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => {
    calls.push('browser/network');
    throw new Error('browser/network is unavailable while rendering');
  };
  try {
    transform(this, '$$x_{memory-only}+11$$');
  } finally {
    globalThis.fetch = originalFetch;
    for (const restore of patches.reverse()) restore();
  }
  this.externalCalls = calls;
  this.browserModules = Object.keys(require.cache).filter((path) => /playwright|puppeteer/iu.test(path));
});

Then('SVGとPNGの保存、ネットワーク、ブラウザ、子プロセスを使わない', function () {
  assert.deepEqual({
    externalCalls: this.externalCalls,
    browserModules: this.browserModules,
    renderedAsImage: imageCount(this.rendered)
  }, { externalCalls: [], browserModules: [], renderedAsImage: 1 });
});

Given('pi-formula を新しい Node.js プロセスで読み込む', function () {
  this.projectRoot = resolve(__dirname, '../..');
});

When('表示数式を初めて変換する', function () {
  const script = `
    const loaded = () => Object.keys(require.cache).some((path) =>
      path.includes('@mathjax/src') || path.includes('@resvg/resvg-js'));
    const registerFormula = require('./dist/extension.js').default;
    const { fakePi, startWithKitty } = require('./test/support/fake-pi.js');
    const before = loaded();
    (async () => {
      const pi = fakePi(); registerFormula(pi.api); await startWithKitty(pi);
      const afterSessionStart = loaded();
      pi.transformer()('$$x_{lazy}$$', {
        messageType: 'assistant', isStreaming: false, availableWidth: 80
      });
      process.stdout.write(JSON.stringify({ before, afterSessionStart, afterFormula: loaded() }));
    })().catch((error) => { console.error(error); process.exitCode = 1; });
  `;
  const result = childProcess.spawnSync(process.execPath, ['-e', script], {
    cwd: this.projectRoot, encoding: 'utf8'
  });
  assert.equal(result.status, 0, result.stderr);
  this.lazyPreparation = JSON.parse(result.stdout);
});

Then('MathJaxとResvgは最初の表示数式で初めて準備される', function () {
  assert.deepEqual(this.lazyPreparation, {
    before: false,
    afterSessionStart: false,
    afterFormula: true
  });
});

When('初回、次の異なる数式、一時保存済み数式を計測する', function () {
  const renderTimed = (latex) => {
    const started = performance.now();
    this.pi.transformer()(`$$${latex}$$`, {
      messageType: 'assistant', isStreaming: false, availableWidth: 80
    });
    return performance.now() - started;
  };
  const seed = `${process.pid}-${Date.now()}`;
  this.durations = {
    first: renderTimed(`x_{first-${seed}}`),
    next: renderTimed(`x_{next-${seed}}`)
  };
  this.durations.cached = renderTimed(`x_{next-${seed}}`);
});

Then('初回は1秒未満、次は200ミリ秒未満、一時保存済みは5ミリ秒未満である', function () {
  assert.ok(
    this.durations.first < 1000 && this.durations.next < 200 && this.durations.cached < 5,
    JSON.stringify(this.durations)
  );
});
