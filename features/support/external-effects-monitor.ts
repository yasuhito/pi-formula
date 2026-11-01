const childProcess: typeof import("node:child_process") = require("node:child_process");
const fs: typeof import("node:fs") = require("node:fs");
const http: typeof import("node:http") = require("node:http");
const https: typeof import("node:https") = require("node:https");
const net: typeof import("node:net") = require("node:net");

function monitorExternalEffects() {
  const calls: string[] = [];
  const patches: (() => void)[] = [];
  const block = <Owner extends object>(
    owner: Owner,
    name: keyof Owner,
    kind: string,
  ) => {
    const original = owner[name];
    patches.push(() => {
      Reflect.set(owner, name, original);
    });
    Reflect.set(owner, name, (..._args: unknown[]) => {
      calls.push(kind);
      throw new Error(`${kind} is unavailable while rendering`);
    });
  };
  for (const name of [
    "writeFileSync",
    "writeFile",
    "appendFileSync",
    "appendFile",
    "createWriteStream",
  ] as const) {
    block(fs, name, "disk");
  }
  for (const name of ["connect", "createConnection"] as const)
    block(net, name, "network");
  for (const name of ["request", "get"] as const) block(http, name, "network");
  for (const name of ["request", "get"] as const) block(https, name, "network");
  for (const name of [
    "spawn",
    "spawnSync",
    "exec",
    "execSync",
    "fork",
  ] as const) {
    block(childProcess, name, "child process");
  }
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => {
    calls.push("browser/network");
    throw new Error("browser/network is unavailable while rendering");
  };
  return {
    calls,
    restore() {
      globalThis.fetch = originalFetch;
      for (const restore of patches.reverse()) restore();
    },
  };
}

module.exports = { monitorExternalEffects };
export type ExternalEffectsModule = {
  monitorExternalEffects: typeof monitorExternalEffects;
};
