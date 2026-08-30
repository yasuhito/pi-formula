const assert = require('node:assert/strict');
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
