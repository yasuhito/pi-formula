export interface TerminalUi {
  addInputListener(
    listener: (
      data: string,
    ) => { consume: true } | { data: string } | undefined,
  ): () => void;
  terminal: { write(data: string): void };
}

export interface TerminalProbe {
  path: "image" | "text";
  reason: string;
  response: string;
}

const PROBE_PNG =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVR4nGP4DwQACfsD/fteaysAAAAASUVORK5CYII=";
const PROBE_TIMEOUT_MS = 300;
let nextProbeId = 1_900_000_000;

export function multiplexerProbeResult(
  env: NodeJS.ProcessEnv,
): TerminalProbe | undefined {
  if (
    env.TMUX ||
    env.TERM?.startsWith("tmux") ||
    env.TERM?.startsWith("screen")
  ) {
    return {
      path: "text",
      reason: "terminal multiplexer",
      response: "not queried",
    };
  }
  return undefined;
}

function possiblePrefixSuffix(value: string, prefix: string): number {
  const maximum = Math.min(value.length, prefix.length - 1);
  for (let length = maximum; length > 0; length -= 1) {
    if (prefix.startsWith(value.slice(-length))) return length;
  }
  return 0;
}

interface TerminalResponseRequest<Result> {
  prefix: string;
  query: string;
  terminators: readonly string[];
  timeoutResult: Result;
  parse(value: string): Result;
}

function queryTerminalResponse<Result>(
  tui: TerminalUi,
  request: TerminalResponseRequest<Result>,
): Promise<Result> {
  return new Promise((resolve) => {
    let pendingPrefix = "";
    let response = "";
    let settled = false;
    let unsubscribe = () => {};
    const finish = (result: Result): void => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      unsubscribe();
      resolve(result);
    };
    const timeout = setTimeout(
      () => finish(request.timeoutResult),
      PROBE_TIMEOUT_MS,
    );
    timeout.unref?.();

    const completeResponse = ():
      | { consume: true }
      | { data: string }
      | undefined => {
      const endings = request.terminators
        .map((terminator) => ({
          terminator,
          index: response.indexOf(terminator),
        }))
        .filter(({ index }) => index >= 0)
        .sort((first, second) => first.index - second.index);
      const ending = endings[0];
      if (!ending) return undefined;
      const value = response.slice(request.prefix.length, ending.index);
      const trailingInput = response.slice(
        ending.index + ending.terminator.length,
      );
      finish(request.parse(value));
      return trailingInput ? { data: trailingInput } : { consume: true };
    };

    unsubscribe = tui.addInputListener((data) => {
      if (response) {
        response += data;
        return completeResponse() ?? { consume: true };
      }

      const candidate = pendingPrefix + data;
      pendingPrefix = "";
      const start = candidate.indexOf(request.prefix);
      if (start >= 0) {
        const leadingInput = candidate.slice(0, start);
        response = candidate.slice(start);
        const completed = completeResponse();
        if (completed && "data" in completed) {
          const returnedInput = leadingInput + completed.data;
          return returnedInput ? { data: returnedInput } : { consume: true };
        }
        return leadingInput
          ? { data: leadingInput }
          : (completed ?? { consume: true });
      }

      const suffixLength = possiblePrefixSuffix(candidate, request.prefix);
      pendingPrefix = suffixLength > 0 ? candidate.slice(-suffixLength) : "";
      const input =
        suffixLength > 0 ? candidate.slice(0, -suffixLength) : candidate;
      return input ? { data: input } : { consume: true };
    });
    tui.terminal.write(request.query);
  });
}

function rgbChannel(value: string): number {
  const maximum = 16 ** value.length - 1;
  return Math.round((Number.parseInt(value, 16) / maximum) * 255);
}

function exactRgb(response: string): string | undefined {
  const match = /^([\da-f]{1,4})\/([\da-f]{1,4})\/([\da-f]{1,4})$/iu.exec(
    response,
  );
  if (!match) return undefined;
  return `#${match
    .slice(1)
    .map(rgbChannel)
    .map((channel) => channel.toString(16).padStart(2, "0"))
    .join("")}`;
}

function queryTerminalColor(
  tui: TerminalUi,
  osc: 10 | 11,
): Promise<string | undefined> {
  return queryTerminalResponse(tui, {
    prefix: `\x1b]${osc};rgb:`,
    query: `\x1b]${osc};?\x1b\\`,
    terminators: ["\x1b\\", "\x07"],
    timeoutResult: undefined,
    parse: exactRgb,
  });
}

export function queryTerminalForeground(
  tui: TerminalUi,
): Promise<string | undefined> {
  return queryTerminalColor(tui, 10);
}

export function queryTerminalBackground(
  tui: TerminalUi,
): Promise<string | undefined> {
  return queryTerminalColor(tui, 11);
}

export function probePngSupport(tui: TerminalUi): Promise<TerminalProbe> {
  const imageId = nextProbeId++;
  return queryTerminalResponse(tui, {
    prefix: `\x1b_Gi=${imageId};`,
    query: `\x1b_Ga=q,t=d,f=100,i=${imageId},s=1,v=1;${PROBE_PNG}\x1b\\`,
    terminators: ["\x1b\\"],
    timeoutResult: {
      path: "text",
      reason: "PNG query timed out",
      response: "timeout",
    },
    parse: (value): TerminalProbe =>
      value === "OK"
        ? { path: "image", reason: "PNG query returned OK", response: value }
        : { path: "text", reason: "PNG query was rejected", response: value },
  });
}
