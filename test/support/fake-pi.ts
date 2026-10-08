import type {
  ExtensionAPI,
  ExtensionCommandContext,
  ExtensionUIContext,
  MarkdownTransformer,
} from "@earendil-works/pi-coding-agent";
import type { Terminal, TUI } from "@earendil-works/pi-tui";
import { RegisteredMap, strictStub } from "./strict-stub.js";

type SessionEntry = { type: "custom"; customType: string; data?: unknown };
type Handler = (...args: unknown[]) => unknown;
function isHandler(value: unknown): value is Handler {
  return typeof value === "function";
}
type Command = Parameters<ExtensionAPI["registerCommand"]>[1];
type Tool = unknown;
type Widget =
  | string[]
  | ((tui: TUI, theme: ExtensionUIContext["theme"]) => unknown)
  | undefined;
export interface SharedPi {
  handlers?: RegisteredMap<string, Handler>;
  commands?: RegisteredMap<string, Command>;
  tools?: RegisteredMap<string, Tool>;
  entries?: SessionEntry[];
  transformer?: MarkdownTransformer;
  transformerRegistrations?: number;
  commandRegistrations?: number;
  sessionEntries?: SessionEntry[];
}
interface FakePiOptions {
  shared?: SharedPi;
  sessionEntries?: SessionEntry[];
}
export interface SessionOptions {
  mode?: ExtensionCommandContext["mode"];
  textColor?: string;
  foregroundAnsi?: string;
  foregroundResponse?: string;
  backgroundResponse?: string;
  response?: string;
}

class WidgetMap extends Map<string, Widget> {
  override get(name: "pi-formula-status"): string[];
  override get(name: string): Widget;
  override get(name: string): Widget {
    const value = super.get(name);
    if (name === "pi-formula-status" && !Array.isArray(value))
      throw new Error("Status widget is not text");
    return value;
  }
}

const FORMULA_SHARED_KEY = Symbol.for("pi-formula.shared-api.v1");

function resetFormulaState() {
  Reflect.deleteProperty(globalThis, FORMULA_SHARED_KEY);
}

function fakePi(options: FakePiOptions = {}) {
  const previous = options.shared ?? {};
  const shared = Object.assign(previous, {
    handlers: previous.handlers ?? new RegisteredMap<string, Handler>(),
    commands: previous.commands ?? new RegisteredMap<string, Command>(),
    tools: previous.tools ?? new RegisteredMap<string, Tool>(),
    entries: previous.entries ?? [],
    transformer: previous.transformer,
    transformerRegistrations: previous.transformerRegistrations ?? 0,
    commandRegistrations: previous.commandRegistrations ?? 0,
    sessionEntries: previous.sessionEntries ?? options.sessionEntries ?? [],
  });
  return {
    api: strictStub<ExtensionAPI>(
      {
        on(name: string, handler: unknown) {
          if (!isHandler(handler))
            throw new TypeError("Expected event handler");
          shared.handlers.set(name, (...args: unknown[]): unknown =>
            handler(...args),
          );
          return () => {
            shared.handlers.delete(name);
          };
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
      "ExtensionAPI",
    ),
    entries: shared.entries,
    handlers: shared.handlers,
    commands: shared.commands,
    tools: shared.tools,
    sessionEntries: shared.sessionEntries,
    registrationCounts: () => ({
      transformerRegistrations: shared.transformerRegistrations,
      commandRegistrations: shared.commandRegistrations,
    }),
    transformer: () => {
      if (!shared.transformer)
        throw new Error("Markdown transformer is not registered");
      return shared.transformer;
    },
  };
}

async function startSession(
  pi: ReturnType<typeof fakePi>,
  options: SessionOptions = {},
) {
  let inputListener: Parameters<TUI["addInputListener"]>[0] | undefined;
  let terminalWrites = 0;
  let textColor = options.textColor ?? "\x1b[38;2;212;212;212m";
  const tui = strictStub<TUI>(
    {
      addInputListener(listener) {
        inputListener = listener;
        return () => {
          inputListener = undefined;
        };
      },
      terminal: strictStub<Terminal>(
        {
          write(query) {
            terminalWrites += 1;
            if (query === "\x1b]10;?\x1b\\") {
              const foreground =
                options.foregroundResponse ?? "rgb:d4d4/d4d4/d4d4";
              queueMicrotask(() =>
                inputListener?.(`\x1b]10;${foreground}\x1b\\`),
              );
              return;
            }
            if (query === "\x1b]11;?\x1b\\") {
              const background = options.backgroundResponse ?? "rgb:invalid";
              queueMicrotask(() =>
                inputListener?.(`\x1b]11;${background}\x1b\\`),
              );
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
        "Terminal",
      ),
    },
    "TUI",
  );
  const widgets = new WidgetMap();
  const notifications: Array<{
    message: string;
    level: "info" | "warning" | "error" | undefined;
  }> = [];
  const ctx = strictStub<ExtensionCommandContext>(
    {
      mode: options.mode ?? "tui",
      sessionManager: strictStub<ExtensionCommandContext["sessionManager"]>(
        {
          getBranch: () =>
            pi.sessionEntries.map((entry, index) => ({
              ...entry,
              id: String(index),
              parentId: null,
              timestamp: "2026-01-01T00:00:00Z",
            })),
        },
        "SessionManager",
      ),
      ui: strictStub<ExtensionUIContext>(
        {
          notify(message, level) {
            notifications.push({ message, level });
          },
          theme: strictStub<ExtensionUIContext["theme"]>(
            { getFgAnsi: () => textColor },
            "Theme",
          ),
          setWidget(name: string, value: Widget) {
            widgets.set(name, value);
            if (typeof value === "function") value(tui, ctx.ui.theme);
          },
        },
        "ExtensionUIContext",
      ),
    },
    "ExtensionContext",
  );
  await pi.handlers.get("session_start")({ reason: "startup" }, ctx);
  return {
    ctx,
    notifications,
    terminalWrites,
    widgets,
    setTextColor(value: string) {
      textColor = value;
    },
  };
}

function startWithKitty(
  pi: ReturnType<typeof fakePi>,
  options: SessionOptions = {},
) {
  return startSession(pi, {
    ...options,
    response: options.response ?? "OK",
    textColor: options.foregroundAnsi ?? options.textColor,
  });
}

function startWithText(pi: ReturnType<typeof fakePi>) {
  return startSession(pi, { mode: "rpc" });
}

export {
  fakePi,
  resetFormulaState,
  startSession,
  startWithKitty,
  startWithText,
};
