#!/usr/bin/env node
const { spawnSync } = require("node:child_process");
const { resolveVtTool } = require("./vt-tool");

function main() {
  const tool = resolveVtTool();
  if (!tool) {
    console.log("SKIP: libghostty-vt のプロトコル検査（vt-pty がありません）");
    return 0;
  }

  const result = spawnSync(tool, process.argv.slice(2), { stdio: "inherit" });
  if (result.error) {
    console.error(`vt-pty を実行できませんでした: ${result.error.message}`);
    return 2;
  }
  if (result.signal) {
    console.error(`vt-pty が signal ${result.signal} で停止しました`);
    return 2;
  }
  return result.status ?? 2;
}

process.exitCode = main();
