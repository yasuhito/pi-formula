const {
  spawn,
}: typeof import("node:child_process") = require("node:child_process");
const { resolve }: typeof import("node:path") = require("node:path");

export interface RendererConfiguration {
  blockKeyCreation?: boolean;
  blockDynamicFont?: boolean;
}
interface RendererResults {
  load: {
    loaded: boolean;
    limits: typeof import("../../dist/typesetter.js").FORMULA_SAFETY_LIMITS;
  };
  register: { loaded: boolean };
  start: { loaded: boolean };
  render: {
    markdown: string;
    duration: number;
    loaded: boolean;
    keyCreations: number;
  };
}
export type RendererOperation = keyof RendererResults;
export type RendererResult = RendererResults[RendererOperation];
export interface RendererPayload {
  markdown?: string;
}
export interface RendererRequest {
  id: number;
  operation: RendererOperation;
  payload: RendererPayload;
}
interface RendererReply {
  id: number;
  result?: RendererResult;
  error?: string;
}

function isolatedRenderer(configuration: RendererConfiguration = {}) {
  const child = spawn(
    process.execPath,
    [
      resolve(__dirname, "isolated-renderer-worker.js"),
      JSON.stringify(configuration),
    ],
    { stdio: ["ignore", "ignore", "pipe", "ipc"] },
  );
  let sequence = 0;
  let stderr = "";
  let stopped = false;
  const pending = new Map<
    number,
    {
      resolve(result: RendererResult): void;
      reject(reason: unknown): void;
      timer: ReturnType<typeof setTimeout>;
    }
  >();
  child.stderr?.on("data", (chunk: Buffer) => {
    stderr += chunk;
  });
  const completion = new Promise<void>((resolveCompletion) => {
    const finish = (detail: string) => {
      stopped = true;
      for (const request of pending.values()) {
        clearTimeout(request.timer);
        request.reject(
          new Error(`isolated renderer stopped: ${detail}\n${stderr}`),
        );
      }
      pending.clear();
      resolveCompletion();
    };
    child.once("error", (error) => finish(error.message));
    child.once("exit", (code, signal) => finish(`${code}/${signal}`));
  });
  child.on("message", ({ id, result, error }: RendererReply) => {
    const request = pending.get(id);
    if (!request) return;
    clearTimeout(request.timer);
    pending.delete(id);
    if (error) request.reject(new Error(error));
    else if (result) request.resolve(result);
    else request.reject(new Error("isolated renderer returned no result"));
  });
  return {
    request<Operation extends RendererOperation>(
      operation: Operation,
      payload: RendererPayload = {},
    ): Promise<RendererResults[Operation]> {
      if (stopped)
        return Promise.reject(
          new Error(`isolated renderer already stopped\n${stderr}`),
        );
      const id = ++sequence;
      return new Promise<RendererResults[Operation]>(
        (resolveRequest, reject) => {
          const timer = setTimeout(() => {
            pending.delete(id);
            reject(
              new Error(`isolated renderer timed out: ${operation}\n${stderr}`),
            );
          }, 10_000);
          // The worker checks its results against the shared protocol. IPC erases
          // the association between this request's operation and its reply.
          pending.set(id, {
            resolve: (result) =>
              resolveRequest(result as RendererResults[Operation]),
            reject,
            timer,
          });
          child.send({ id, operation, payload }, (error) => {
            if (!error || !pending.has(id)) return;
            clearTimeout(timer);
            pending.delete(id);
            reject(error);
          });
        },
      );
    },
    async close() {
      if (stopped) return;
      child.kill("SIGTERM");
      const force = setTimeout(() => child.kill("SIGKILL"), 1_000);
      await completion;
      clearTimeout(force);
    },
  };
}

module.exports = { isolatedRenderer };
export type RendererModule = { isolatedRenderer: typeof isolatedRenderer };
