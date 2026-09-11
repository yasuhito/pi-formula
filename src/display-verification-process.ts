import { spawn } from "node:child_process";

type DisplayProcessOperation =
  | "plan"
  | "protocol"
  | "launch"
  | "capture-initial"
  | "capture-reflow"
  | "reflow";

export interface ProcessRequest {
  label: string;
  operation?: DisplayProcessOperation;
  command: string;
  args?: readonly string[];
  cwd?: string;
  env?: NodeJS.ProcessEnv;
  timeoutMs: number;
}

export interface ProcessOutcome {
  status: number;
  stdout: string;
  stderr: string;
  timedOut: boolean;
  cleanupDiagnostics?: string[];
}

export interface ManagedProcess {
  readonly pid: number;
  readonly completion: Promise<ProcessOutcome>;
  terminate(signal?: NodeJS.Signals): Promise<string[]>;
}

export interface DisplayProcessAdapter {
  run(request: ProcessRequest, signal?: AbortSignal): Promise<ProcessOutcome>;
  spawn(request: ProcessRequest, signal?: AbortSignal): ManagedProcess;
}

const TERMINATION_GRACE_MS = 1_000;

function alreadyStopped(error: unknown): boolean {
  return (error as NodeJS.ErrnoException).code === "ESRCH";
}

function killProcess(pid: number, signal: NodeJS.Signals): void {
  process.kill(-pid, signal);
}

function nodeProcess(
  request: ProcessRequest,
  signal?: AbortSignal,
): { managed: ManagedProcess; childPid: number } {
  const child = spawn(request.command, [...(request.args ?? [])], {
    cwd: request.cwd,
    env: request.env,
    detached: true,
    stdio: ["ignore", "pipe", "pipe"],
  });
  let stdout = "";
  let stderr = "";
  let timedOut = false;
  let aborted = signal?.aborted ?? false;
  let settled = false;
  let timer: NodeJS.Timeout | undefined;
  let termination: Promise<string[]> | undefined;

  child.stdout.setEncoding("utf8");
  child.stderr.setEncoding("utf8");
  child.stdout.on("data", (data: string) => {
    stdout += data;
  });
  child.stderr.on("data", (data: string) => {
    stderr += data;
  });

  const groupExists = (pid: number): boolean => {
    try {
      process.kill(-pid, 0);
      return true;
    } catch (error) {
      if (alreadyStopped(error)) return false;
      throw error;
    }
  };

  const waitForGroupExit = async (pid: number, timeoutMs: number) => {
    const deadline = Date.now() + timeoutMs;
    while (groupExists(pid) && Date.now() < deadline) {
      await new Promise((resolve) => setTimeout(resolve, 20));
    }
    return !groupExists(pid);
  };

  const doTerminate = async (terminationSignal: NodeJS.Signals) => {
    const diagnostics: string[] = [];
    if (child.pid === undefined) return diagnostics;
    try {
      killProcess(child.pid, terminationSignal);
    } catch (error) {
      if (!alreadyStopped(error)) diagnostics.push(String(error));
    }
    const stopped = await waitForGroupExit(child.pid, TERMINATION_GRACE_MS);
    if (!stopped && terminationSignal !== "SIGKILL") {
      try {
        killProcess(child.pid, "SIGKILL");
        if (!(await waitForGroupExit(child.pid, TERMINATION_GRACE_MS)))
          diagnostics.push(`process group ${child.pid} did not stop`);
      } catch (error) {
        if (!alreadyStopped(error)) diagnostics.push(String(error));
      }
    }
    return diagnostics;
  };

  const terminate = (terminationSignal: NodeJS.Signals = "SIGTERM") => {
    termination ??= doTerminate(terminationSignal);
    return termination;
  };

  const abort = () => {
    aborted = true;
    void terminate();
  };
  signal?.addEventListener("abort", abort, { once: true });

  const completion = new Promise<ProcessOutcome>((resolve) => {
    const finish = (status: number) => {
      if (settled) return;
      settled = true;
      if (timer) clearTimeout(timer);
      signal?.removeEventListener("abort", abort);
      resolve({
        status: timedOut || aborted ? 2 : status,
        stdout,
        stderr,
        timedOut,
      });
    };
    child.once("error", (error) => {
      stderr += `${error.message}\n`;
      finish(2);
    });
    child.once("close", (code, childSignal) => {
      const status = code ?? (childSignal ? 2 : 0);
      if (termination)
        void termination.then(
          () => finish(status),
          () => finish(status),
        );
      else finish(status);
    });
    timer = setTimeout(() => {
      timedOut = true;
      void terminate();
    }, request.timeoutMs);
    timer.unref?.();
  });
  if (signal?.aborted) abort();

  return {
    childPid: child.pid ?? -1,
    managed: { pid: child.pid ?? -1, completion, terminate },
  };
}

export class NodeDisplayProcessAdapter implements DisplayProcessAdapter {
  async run(
    request: ProcessRequest,
    signal?: AbortSignal,
  ): Promise<ProcessOutcome> {
    const { managed } = nodeProcess(request, signal);
    const outcome = await managed.completion;
    const cleanupDiagnostics = await managed.terminate();
    if (cleanupDiagnostics.length === 0) return outcome;
    return {
      ...outcome,
      status: outcome.status === 0 ? 2 : outcome.status,
      cleanupDiagnostics,
    };
  }

  spawn(request: ProcessRequest, signal?: AbortSignal): ManagedProcess {
    return nodeProcess(request, signal).managed;
  }
}
