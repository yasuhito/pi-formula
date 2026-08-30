const assert = require('node:assert/strict');
const { mkdirSync, mkdtempSync, readFileSync, writeFileSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { join } = require('node:path');
const test = require('node:test');

const registerFormula = require('../dist/extension.js').default;
const { fakePi, startSession, startWithKitty } = require('./support/fake-pi');

test('inline formulas stay in Pi Markdown without image transfer', async () => {
  const pi = fakePi();
  registerFormula(pi.api);
  await startWithKitty(pi);
  const markdown = 'Use $x+1$ and \\(y-1\\).';

  const rendered = pi.transformer()(markdown, {
    messageType: 'assistant', isStreaming: false, availableWidth: 80
  });

  assert.equal(rendered, markdown);
});

test('display formulas use a Kitty PNG transfer and placeholder rows', async () => {
  const pi = fakePi();
  registerFormula(pi.api);
  await startWithKitty(pi);

  const rendered = pi.transformer()('Before\n$$\\frac{1}{2}$$\nAfter', {
    messageType: 'assistant', isStreaming: false, availableWidth: 80
  });

  assert.deepEqual({
    hasPngTransfer: rendered.includes('\x1b_Ga=T,f=100'),
    hasPlaceholder: rendered.includes(String.fromCodePoint(0x10eeee)),
    hasLatex: rendered.includes('\\frac{1}{2}')
  }, {
    hasPngTransfer: true,
    hasPlaceholder: true,
    hasLatex: false
  });
});

test('an unreadably scaled formula uses text without retaining image bytes', async () => {
  const pi = fakePi();
  registerFormula(pi.api);
  const started = await startWithKitty(pi);
  await pi.commands.get('formula').handler('clear', started.ctx);
  const markdown = '$$\\frac{12345678901234567890}{12345678901234567890}$$';

  const rendered = pi.transformer()(markdown, {
    messageType: 'assistant', isStreaming: false, availableWidth: 10
  });
  await pi.commands.get('formula').handler('status', started.ctx);
  const cacheBytes = Number(/cache: 1 entries, (\d+) bytes/u.exec(
    started.widgets.get('pi-formula-status').join('\n')
  )?.[1]);

  assert.deepEqual({ rendered, lightweightCache: cacheBytes > 0 && cacheBytes < 1000 }, {
    rendered: markdown,
    lightweightCache: true
  });
});

test('bracketed display formulas are placed at the content left edge', async () => {
  const pi = fakePi();
  registerFormula(pi.api);
  await startWithKitty(pi);

  const rendered = pi.transformer()('\\[x^2\\]', {
    messageType: 'assistant', isStreaming: false, availableWidth: 80
  });
  const placeholderLine = rendered.split('\n')
    .find((line) => line.includes(String.fromCodePoint(0x10eeee)));

  assert.equal(placeholderLine?.startsWith('\x1b['), true);
});

test('code blocks and escaped display delimiters stay unchanged', async () => {
  const pi = fakePi();
  registerFormula(pi.api);
  await startWithKitty(pi);
  const markdown = [
    '    $$indented$$',
    '> ```text',
    '> $$quoted$$',
    '> ```',
    '\\\\[literal\\\\]'
  ].join('\n');

  const rendered = pi.transformer()(markdown, {
    messageType: 'assistant', isStreaming: false, availableWidth: 80
  });

  assert.equal(rendered, markdown);
});

test('the display-only hook leaves persistence and model-context hooks untouched', () => {
  const pi = fakePi();
  registerFormula(pi.api);

  assert.deepEqual([...pi.handlers.keys()], ['session_start']);
});

test('registering the package twice does not duplicate formula rendering', () => {
  const pi = fakePi();

  registerFormula(pi.api);
  registerFormula(pi.api);

  assert.deepEqual(pi.registrationCounts(), {
    transformerRegistrations: 1,
    commandRegistrations: 1
  });
});

test('a saved session path overrides a rejected automatic probe', async () => {
  const pi = fakePi({
    sessionEntries: [{
      type: 'custom', customType: 'pi-formula-path', data: { path: 'image' }
    }]
  });
  registerFormula(pi.api);
  const { ctx, widgets } = await startSession(pi, { response: 'EINVAL' });

  await pi.commands.get('formula').handler('status', ctx);

  assert.equal(widgets.get('pi-formula-status').includes('path: image'), true);
});

test('a default rename failure leaves the session path unchanged and reports the error', async () => {
  const xdg = mkdtempSync(join(tmpdir(), 'pi-formula-write-failure-'));
  mkdirSync(join(xdg, 'pi-formula', 'config.json'), { recursive: true });
  const original = process.env.XDG_CONFIG_HOME;
  process.env.XDG_CONFIG_HOME = xdg;
  try {
    const pi = fakePi();
    registerFormula(pi.api);
    const started = await startSession(pi, { response: 'OK' });

    await pi.commands.get('formula').handler('text --default', started.ctx);
    await pi.commands.get('formula').handler('status', started.ctx);

    assert.deepEqual({
      savedEntries: pi.entries.length,
      path: started.widgets.get('pi-formula-status').find((line) => line.startsWith('path:')),
      notification: started.notifications.at(-1)
    }, {
      savedEntries: 0,
      path: 'path: image',
      notification: {
        message: 'Could not save the pi-formula default; the session path was not changed.',
        level: 'error'
      }
    });
  } finally {
    if (original === undefined) delete process.env.XDG_CONFIG_HOME;
    else process.env.XDG_CONFIG_HOME = original;
  }
});

test('invalid config is preserved when changing or clearing the default path', async () => {
  const xdg = mkdtempSync(join(tmpdir(), 'pi-formula-invalid-config-'));
  const configPath = join(xdg, 'pi-formula', 'config.json');
  mkdirSync(join(xdg, 'pi-formula'), { recursive: true });
  const original = process.env.XDG_CONFIG_HOME;
  process.env.XDG_CONFIG_HOME = xdg;
  try {
    const results = [];
    for (const raw of ['{ broken JSON', '[]']) {
      for (const action of ['auto --default', 'text --default']) {
        writeFileSync(configPath, raw);
        const pi = fakePi();
        registerFormula(pi.api);
        const started = await startSession(pi, { response: 'OK' });

        await pi.commands.get('formula').handler(action, started.ctx);
        await pi.commands.get('formula').handler('status', started.ctx);
        results.push({
          contents: readFileSync(configPath, 'utf8'),
          savedEntries: pi.entries.length,
          path: started.widgets.get('pi-formula-status')
            .find((line) => line.startsWith('path:')),
          notification: started.notifications.at(-1)
        });
      }
    }

    assert.equal(results.every((result, index) =>
      result.contents === (index < 2 ? '{ broken JSON' : '[]')
      && result.savedEntries === 0
      && result.path === 'path: image'
      && result.notification?.level === 'error'
    ), true);
  } finally {
    if (original === undefined) delete process.env.XDG_CONFIG_HOME;
    else process.env.XDG_CONFIG_HOME = original;
  }
});

test('/formula status reports the package version and image path in English', async () => {
  const pi = fakePi();
  registerFormula(pi.api);
  const { ctx, widgets } = await startWithKitty(pi);

  await pi.commands.get('formula').handler('status', ctx);

  assert.deepEqual(widgets.get('pi-formula-status').slice(0, 2), [
    'pi-formula 0.1.0',
    'path: image'
  ]);
});
