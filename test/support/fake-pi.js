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

function rgbThemeColor(ansi) {
  const match = /38;2;(\d+);(\d+);(\d+)/u.exec(ansi);
  if (!match) return { kind: "invalid" };
  const [r, g, b] = match.slice(1).map(Number);
  return { kind: "rgb", r, g, b };
}

async function startSession(pi, options = {}) {
  let inputListener;
  let terminalWrites = 0;
  let textColor = options.textColor ?? "\x1b[38;2;212;212;212m";
  let themeColor = Object.hasOwn(options, "themeColor")
    ? options.themeColor
    : rgbThemeColor(textColor);
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
        if (query === "\x1b]10;?\x1b\\") {
          const foreground = options.foregroundResponse ?? "rgb:d4d4/d4d4/d4d4";
          queueMicrotask(() => inputListener?.(`\x1b]10;${foreground}\x1b\\`));
          return;
        }
        if (query === "\x1b]11;?\x1b\\") {
          const background = options.backgroundResponse ?? "rgb:invalid";
          queueMicrotask(() => inputListener?.(`\x1b]11;${background}\x1b\\`));
          return;
        }
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
      theme: {
        colors: {
          get text() {
            return themeColor;
          },
        },
        getFgAnsi: () => textColor,
      },
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
      themeColor = rgbThemeColor(value);
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
