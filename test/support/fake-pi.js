function fakePi(options = {}) {
  const handlers = new Map();
  const commands = new Map();
  const entries = [];
  let transformer;
  let transformerRegistrations = 0;
  let commandRegistrations = 0;
  return {
    api: {
      on(name, handler) { handlers.set(name, handler); },
      appendEntry(customType, data) { entries.push({ type: 'custom', customType, data }); },
      registerMarkdownTransformer(value) {
        transformer = value;
        transformerRegistrations += 1;
      },
      registerCommand(name, command) {
        commands.set(name, command);
        commandRegistrations += 1;
      }
    },
    entries,
    handlers,
    commands,
    sessionEntries: options.sessionEntries ?? [],
    registrationCounts: () => ({ transformerRegistrations, commandRegistrations }),
    transformer: () => transformer
  };
}

async function startSession(pi, options = {}) {
  let inputListener;
  let terminalWrites = 0;
  const tui = {
    addInputListener(listener) {
      inputListener = listener;
      return () => { inputListener = undefined; };
    },
    terminal: {
      write(query) {
        terminalWrites += 1;
        const id = /i=(\d+)/u.exec(query)?.[1];
        if (options.response !== undefined) {
          queueMicrotask(() => inputListener?.(`\x1b_Gi=${id};${options.response}\x1b\\`));
        }
      }
    }
  };
  const widgets = new Map();
  const notifications = [];
  const ctx = {
    mode: options.mode ?? 'tui',
    sessionManager: { getBranch: () => pi.sessionEntries },
    ui: {
      notify(message, level) { notifications.push({ message, level }); },
      theme: { getFgAnsi: () => '\x1b[38;2;212;212;212m' },
      setWidget(name, value) {
        widgets.set(name, value);
        if (typeof value === 'function') value(tui);
      }
    }
  };
  await pi.handlers.get('session_start')({ reason: 'startup' }, ctx);
  return { ctx, notifications, terminalWrites, widgets };
}

function startWithKitty(pi) {
  return startSession(pi, { response: 'OK' });
}

module.exports = { fakePi, startSession, startWithKitty };
