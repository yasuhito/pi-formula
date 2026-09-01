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
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M/wHwAF/gL+Xn0YVwAAAABJRU5ErkJggg==";
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

export function probePngSupport(tui: TerminalUi): Promise<TerminalProbe> {
  const imageId = nextProbeId++;
  const query = `\x1b_Ga=q,t=d,f=100,i=${imageId},s=1,v=1;${PROBE_PNG}\x1b\\`;
  return new Promise((resolve) => {
    const prefix = `\x1b_Gi=${imageId};`;
    let pendingPrefix = "";
    let response = "";
    let settled = false;
    let unsubscribe = () => {};
    const finish = (result: TerminalProbe): void => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      unsubscribe();
      resolve(result);
    };
    const timeout = setTimeout(
      () =>
        finish({
          path: "text",
          reason: "PNG query timed out",
          response: "timeout",
        }),
      PROBE_TIMEOUT_MS,
    );
    timeout.unref?.();

    const completeResponse = ():
      | { consume: true }
      | { data: string }
      | undefined => {
      const end = response.indexOf("\x1b\\");
      if (end < 0) return undefined;
      const value = response.slice(prefix.length, end);
      const trailingInput = response.slice(end + 2);
      finish(
        value === "OK"
          ? { path: "image", reason: "PNG query returned OK", response: value }
          : { path: "text", reason: "PNG query was rejected", response: value },
      );
      return trailingInput ? { data: trailingInput } : { consume: true };
    };

    unsubscribe = tui.addInputListener((data) => {
      if (response) {
        response += data;
        return completeResponse() ?? { consume: true };
      }

      const candidate = pendingPrefix + data;
      pendingPrefix = "";
      const start = candidate.indexOf(prefix);
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

      const suffixLength = possiblePrefixSuffix(candidate, prefix);
      pendingPrefix = suffixLength > 0 ? candidate.slice(-suffixLength) : "";
      const input =
        suffixLength > 0 ? candidate.slice(0, -suffixLength) : candidate;
      return input ? { data: input } : { consume: true };
    });
    tui.terminal.write(query);
  });
}
