const FORMULA_SHARED_KEY = Symbol.for("pi-formula.shared-api.v1");

function resetFormulaState() {
  Reflect.deleteProperty(globalThis, FORMULA_SHARED_KEY);
}

function fakePi(options = {}) {
  const shared = options.shared ?? {};
  shared.handlers ??= new Map();
  shared.commands ??= new Map();
  shared.tools ??= new Map();
  shared.entries ??= [];
  shared.transformerRegistrations ??= 0;
  shared.commandRegistrations ??= 0;
  shared.sessionEntries ??= options.sessionEntries ?? [];
  return {
    api: {
      on(name, handler) {
        shared.handlers.set(name, handler);
      },
      appendEntry(customType, data) {
        shared.entries.push({ type: "custom", customType, data });
      },
      registerMarkdownTransformer(value) {
        shared.transformer = value;
        shared.transformerRegistrations += 1;
      },
      registerCommand(name, command) {
        shared.commands.set(name, command);
        shared.commandRegistrations += 1;
      },
      registerTool(tool) {
        shared.tools.set(tool.name, tool);
      },
    },
    entries: shared.entries,
    handlers: shared.handlers,
    commands: shared.commands,
    tools: shared.tools,
    sessionEntries: shared.sessionEntries,
    registrationCounts: () => ({
      transformerRegistrations: shared.transformerRegistrations,
      commandRegistrations: shared.commandRegistrations,
    }),
    transformer: () => shared.transformer,
  };
}

async function startSession(pi, options = {}) {
  let inputListener;
  let terminalWrites = 0;
  let textColor = options.textColor ?? "\x1b[38;2;212;212;212m";
  const tui = {
    addInputListener(listener) {
      inputListener = listener;
      return () => {
        inputListener = undefined;
      };
    },
    terminal: {
      write(query) {
        terminalWrites += 1;
        const id = /i=(\d+)/u.exec(query)?.[1];
        if (options.response !== undefined) {
          queueMicrotask(() =>
            inputListener?.(`\x1b_Gi=${id};${options.response}\x1b\\`),
          );
        }
      },
    },
  };
  const widgets = new Map();
  const notifications = [];
  const ctx = {
    mode: options.mode ?? "tui",
    sessionManager: { getBranch: () => pi.sessionEntries },
    ui: {
      notify(message, level) {
        notifications.push({ message, level });
      },
      theme: { getFgAnsi: () => textColor },
      setWidget(name, value) {
        widgets.set(name, value);
        if (typeof value === "function") value(tui);
      },
    },
  };
  await pi.handlers.get("session_start")({ reason: "startup" }, ctx);
  return {
    ctx,
    notifications,
    terminalWrites,
    widgets,
    setTextColor(value) {
      textColor = value;
    },
  };
}

function startWithKitty(pi, options = {}) {
  return startSession(pi, {
    ...options,
    response: options.response ?? "OK",
    textColor: options.foregroundAnsi ?? options.textColor,
  });
}

function startWithText(pi) {
  return startSession(pi, { mode: "rpc" });
}

module.exports = {
  fakePi,
  resetFormulaState,
  startSession,
  startWithKitty,
  startWithText,
};
