const { spawn } = require("node:child_process");
const { resolve } = require("node:path");

function isolatedRenderer(configuration = {}) {
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
  const pending = new Map();
  child.stderr.on("data", (chunk) => {
    stderr += chunk;
  });
  const completion = new Promise((resolveCompletion) => {
    const finish = (detail) => {
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
  child.on("message", ({ id, result, error }) => {
    const request = pending.get(id);
    if (!request) return;
    clearTimeout(request.timer);
    pending.delete(id);
    if (error) request.reject(new Error(error));
    else request.resolve(result);
  });
  return {
    request(operation, payload = {}) {
      if (stopped)
        return Promise.reject(
          new Error(`isolated renderer already stopped\n${stderr}`),
        );
      const id = ++sequence;
      return new Promise((resolveRequest, reject) => {
        const timer = setTimeout(() => {
          pending.delete(id);
          reject(
            new Error(`isolated renderer timed out: ${operation}\n${stderr}`),
          );
        }, 10_000);
        pending.set(id, { resolve: resolveRequest, reject, timer });
        child.send({ id, operation, payload }, (error) => {
          if (!error || !pending.has(id)) return;
          clearTimeout(timer);
          pending.delete(id);
          reject(error);
        });
      });
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
