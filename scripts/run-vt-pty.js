#!/usr/bin/env node
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const node_child_process_1 = require("node:child_process");
const vt_tool_1 = require("./vt-tool");
function main() {
    const tool = (0, vt_tool_1.resolveVtTool)();
    if (!tool) {
        console.log("SKIP: libghostty-vt protocol check (vt-pty not found)");
        return 0;
    }
    const result = (0, node_child_process_1.spawnSync)(tool, process.argv.slice(2), { stdio: "inherit" });
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
//# sourceMappingURL=run-vt-pty.js.map