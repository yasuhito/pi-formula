export interface TerminalUi {
  addInputListener(listener: (data: string) => { consume: true } | undefined): () => void;
  terminal: { write(data: string): void };
}

export interface TerminalProbe {
  path: "image" | "text";
  reason: string;
  response: string;
}

const PROBE_PNG = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M/wHwAF/gL+Xn0YVwAAAABJRU5ErkJggg==";
const PROBE_TIMEOUT_MS = 300;
let nextProbeId = 1_900_000_000;

export function multiplexerProbeResult(env: NodeJS.ProcessEnv): TerminalProbe | undefined {
  if (env.TMUX || env.TERM?.startsWith("tmux") || env.TERM?.startsWith("screen")) {
    return { path: "text", reason: "terminal multiplexer", response: "not queried" };
  }
  return undefined;
}

export function probePngSupport(tui: TerminalUi): Promise<TerminalProbe> {
  const imageId = nextProbeId++;
  const query = `\x1b_Ga=q,t=d,f=100,i=${imageId},s=1,v=1;${PROBE_PNG}\x1b\\`;
  return new Promise((resolve) => {
    const prefix = `\x1b_Gi=${imageId};`;
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
    const timeout = setTimeout(() => finish({
      path: "text", reason: "PNG query timed out", response: "timeout"
    }), PROBE_TIMEOUT_MS);
    timeout.unref?.();
    unsubscribe = tui.addInputListener((data) => {
      const start = response.length === 0 ? data.indexOf(prefix) : 0;
      if (start < 0) return undefined;
      response += data.slice(start);
      const end = response.indexOf("\x1b\\");
      if (end < 0) return { consume: true };
      const value = response.slice(prefix.length, end);
      finish(value === "OK"
        ? { path: "image", reason: "PNG query returned OK", response: value }
        : { path: "text", reason: `PNG query returned ${value}`, response: value });
      return { consume: true };
    });
    tui.terminal.write(query);
  });
}
