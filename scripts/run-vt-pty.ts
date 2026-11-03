#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { resolveVtTool } from "./vt-tool";

function main() {
  const tool = resolveVtTool();
  if (!tool) {
    console.log("SKIP: libghostty-vt protocol check (vt-pty not found)");
    return 0;
  }

  const result = spawnSync(tool, process.argv.slice(2), { stdio: "inherit" });
  if (result.error) {
    console.error(`Could not run vt-pty: ${result.error.message}`);
    return 2;
  }
  if (result.signal) {
    console.error(`vt-pty stopped with signal ${result.signal}`);
    return 2;
  }
  return result.status ?? 2;
}

process.exitCode = main();
