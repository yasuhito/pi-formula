const childProcess = require("node:child_process");
const fs = require("node:fs");
const http = require("node:http");
const https = require("node:https");
const net = require("node:net");

function monitorExternalEffects() {
  const calls = [];
  const patches = [];
  const block = (owner, name, kind) => {
    const original = owner[name];
    patches.push(() => {
      owner[name] = original;
    });
    owner[name] = (..._args) => {
      calls.push(kind);
      throw new Error(`${kind} is unavailable while rendering`);
    };
  };
  for (const name of [
    "writeFileSync",
    "writeFile",
    "appendFileSync",
    "appendFile",
    "createWriteStream",
  ]) {
    block(fs, name, "disk");
  }
  for (const [owner, names] of [
    [net, ["connect", "createConnection"]],
    [http, ["request", "get"]],
    [https, ["request", "get"]],
  ]) {
    for (const name of names) block(owner, name, "network");
  }
  for (const name of ["spawn", "spawnSync", "exec", "execSync", "fork"]) {
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
