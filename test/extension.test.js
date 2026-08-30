const assert = require('node:assert/strict');
const test = require('node:test');

const registerFormula = require('../dist/extension.js').default;

function fakePi() {
  const handlers = new Map();
  const commands = new Map();
  let transformer;
  let transformerRegistrations = 0;
  let commandRegistrations = 0;
  return {
    api: {
      on(name, handler) { handlers.set(name, handler); },
      registerMarkdownTransformer(value) {
        transformer = value;
        transformerRegistrations += 1;
      },
      registerCommand(name, command) {
        commands.set(name, command);
        commandRegistrations += 1;
      }
    },
    handlers,
    commands,
    registrationCounts: () => ({ transformerRegistrations, commandRegistrations }),
    transformer: () => transformer
  };
}

async function startWithKitty(pi) {
  let inputListener;
  const tui = {
    addInputListener(listener) {
      inputListener = listener;
      return () => { inputListener = undefined; };
    },
    terminal: {
      write(query) {
        const id = /i=(\d+)/u.exec(query)?.[1];
        queueMicrotask(() => inputListener?.(`\x1b_Gi=${id};OK\x1b\\`));
      }
    }
  };
  const widgets = new Map();
  const ctx = {
    mode: 'tui',
    sessionManager: { getBranch: () => [] },
    ui: {
      theme: { getFgAnsi: () => '\x1b[38;2;212;212;212m' },
      setWidget(name, value) {
        widgets.set(name, value);
        if (typeof value === 'function') value(tui);
      }
    }
  };
  await pi.handlers.get('session_start')({ reason: 'startup' }, ctx);
  return { ctx, widgets };
}

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
