import type { TUI } from "@earendil-works/pi-tui" with { "resolution-mode": "import" };

export type TerminalProbe = {
  path: "image" | "text";
  reason: string;
  response: string;
};

const PROBE_PNG = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M/wHwAF/gL+Xn0YVwAAAABJRU5ErkJggg==";
const PROBE_TIMEOUT_MS = 300;
let nextProbeId = 1_900_000_000;

export function multiplexerProbeResult(env: NodeJS.ProcessEnv): TerminalProbe | undefined {
  if (env.TMUX) {
    return { path: "text", reason: "環境変数 TMUX", response: "問い合わせなし" };
  }
  if (env.TERM?.startsWith("tmux")) {
    return { path: "text", reason: `環境変数 TERM=${env.TERM}`, response: "問い合わせなし" };
  }
  if (env.TERM?.startsWith("screen")) {
    return { path: "text", reason: `環境変数 TERM=${env.TERM}`, response: "問い合わせなし" };
  }
  return undefined;
}

export function probePngSupport(tui: TUI): Promise<TerminalProbe> {
  const imageId = nextProbeId++;
  const query = `\x1b_Ga=q,t=d,f=100,i=${imageId},s=1,v=1;${PROBE_PNG}\x1b\\`;

  return new Promise((resolve) => {
    const responsePrefix = `\x1b_Gi=${imageId};`;
    let bufferedLeadingInput = "";
    let bufferedResponse = "";
    let settled = false;
    let unsubscribe = () => {};
    const finish = (result: TerminalProbe): void => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      unsubscribe();
      resolve(result);
    };
    const timeout = setTimeout(() => {
      finish({ path: "text", reason: "問い合わせ無応答", response: "timeout" });
    }, PROBE_TIMEOUT_MS);
    timeout.unref?.();

    unsubscribe = tui.addInputListener((data) => {
      if (bufferedResponse.length === 0) {
        const start = data.indexOf(responsePrefix);
        if (start < 0) {
          const marker = data.indexOf("\x1b_G");
          if (marker < 0 || !responsePrefix.startsWith(data.slice(marker))) return undefined;
          bufferedLeadingInput = data.slice(0, marker);
          bufferedResponse = data.slice(marker);
          return { consume: true };
        }
        bufferedLeadingInput = data.slice(0, start);
        bufferedResponse = data.slice(start);
      } else {
        bufferedResponse += data;
      }

      const terminator = bufferedResponse.indexOf("\x1b\\");
      if (terminator < 0) return { consume: true };
      const response = bufferedResponse.slice(responsePrefix.length, terminator);
      const remainingInput = bufferedLeadingInput + bufferedResponse.slice(terminator + 2);
      if (response === "OK") {
        finish({ path: "image", reason: "問い合わせ応答 OK", response });
      } else {
        finish({ path: "text", reason: `問い合わせ応答 ${response}`, response });
      }
      return remainingInput ? { data: remainingInput } : { consume: true };
    });
    tui.terminal.write(query);
  });
}
