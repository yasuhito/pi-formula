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

module.exports = { fakePi, startWithKitty };
