#!/usr/bin/env node
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const { resolveVtTool } = require("./vt-tool");

const root = path.resolve(__dirname, "..");
const corpusPath = path.join(root, "docs/agents/verify-corpus/issue-52.md");

function displayFormulaCount(markdown) {
  const dollar = markdown.match(/^\$\$\s*$[\s\S]*?^\$\$\s*$/gmu) ?? [];
  const bracket = markdown.match(/^\\\[\s*$[\s\S]*?^\\\]\s*$/gmu) ?? [];
  return dollar.length + bracket.length;
}

function sessionRecord(markdown) {
  const records = [
    {
      type: "session",
      version: 3,
      id: "019fc559-0000-7232-81bb-000000000084",
      timestamp: "2026-09-03T08:00:00.000Z",
      cwd: root,
    },
    {
      type: "model_change",
      id: "m0000001",
      parentId: null,
      timestamp: "2026-09-03T08:00:00.500Z",
      provider: "openai-codex",
      modelId: "gpt-5.6-sol",
    },
    {
      type: "message",
      id: "u0000001",
      parentId: null,
      timestamp: "2026-09-03T08:00:01.000Z",
      message: {
        role: "user",
        content: [{ type: "text", text: "保存済みコーパスを表示する" }],
        timestamp: 1788000001000,
      },
    },
    {
      type: "message",
      id: "a0000001",
      parentId: "u0000001",
      timestamp: "2026-09-03T08:00:02.000Z",
      message: {
        role: "assistant",
        api: "openai-codex-responses",
        provider: "openai-codex",
        model: "gpt-5.6-sol",
        usage: {
          input: 100,
          output: 20,
          cacheRead: 0,
          cacheWrite: 0,
          reasoning: 0,
          totalTokens: 120,
          cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
        },
        stopReason: "stop",
        content: [{ type: "text", text: markdown }],
        timestamp: 1788000002000,
        responseId: "resp_pi_formula_protocol",
        rawStopReason: "completed",
      },
    },
  ];
  return `${records.map((record) => JSON.stringify(record)).join("\n")}\n`;
}

function protocolState(output) {
  const dirty = Number(output.match(/cells\.dirty_placeholders=(\d+)/u)?.[1]);
  const apcLeak = Number(output.match(/cells\.apc_leak=(\d+)/u)?.[1]);
  const placements = Number(output.match(/kitty\.placements=(\d+)/u)?.[1]);
  const virtualImages = [
    ...output.matchAll(/^placement: .* virtual=1 .* image=\{/gmu),
  ].length;
  return { apcLeak, dirty, placements, virtualImages };
}

function inspect(state, expected) {
  if (!Number.isFinite(state.dirty) || state.dirty !== 0) {
    return `Pi を通した placeholder セルに汚れがあります: ${state.dirty}`;
  }
  if (!Number.isFinite(state.apcLeak) || state.apcLeak !== 0) {
    return `Pi を通した本文セルに APC の断片があります: ${state.apcLeak}`;
  }
  if (state.placements !== expected || state.virtualImages !== expected) {
    return (
      `表示数式 ${expected} 件に対して storage 付き仮想配置が ` +
      `${state.virtualImages} 件（全配置 ${state.placements} 件）です`
    );
  }
  return undefined;
}

function run(tool, directory, markdown, expected) {
  const session = path.join(directory, "protocol-session.jsonl");
  const config = path.join(directory, "config");
  fs.mkdirSync(config);
  fs.writeFileSync(session, sessionRecord(markdown));
  const extension =
    process.env.PI_FORMULA_PROTOCOL_EXTENSION ??
    path.join(root, "src/extension.ts");
  const pi = path.join(root, "node_modules/.bin/pi");
  const args = [
    "--cols",
    "160",
    "--rows",
    "200",
    "--settle-ms",
    "1500",
    "--timeout-ms",
    "15000",
    "--",
    pi,
    "--session",
    session,
    "--no-extensions",
    "--extension",
    extension,
    "--no-tools",
    "--no-themes",
    "--no-skills",
    "--no-prompt-templates",
    "--no-context-files",
    "--approve",
    "--thinking",
    "off",
    "--offline",
  ];
  const result = spawnSync(tool, args, {
    cwd: root,
    encoding: "utf8",
    env: {
      ...process.env,
      XDG_CONFIG_HOME: config,
      PI_FORMULA_MACROS: "{}",
      PI_OFFLINE: "1",
    },
    maxBuffer: 50 * 1024 * 1024,
    timeout: 20_000,
  });
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  if (result.error) {
    console.error(
      `Pi を通したプロトコル検査を実行できませんでした: ${result.error.message}`,
    );
    return 2;
  }
  if (result.signal || result.status !== 0) return 2;
  const state = protocolState(result.stdout);
  const problem = inspect(state, expected);
  console.log(
    `pi-protocol: display_formulas=${expected} virtual_images=${state.virtualImages}`,
  );
  if (problem) {
    console.error(problem);
    return 1;
  }
  return 0;
}

function main() {
  const tool = resolveVtTool();
  if (!tool) {
    console.log("SKIP: Pi を通したプロトコル検査（vt-pty がありません）");
    return 0;
  }
  const markdown = fs.readFileSync(corpusPath, "utf8");
  const expected = displayFormulaCount(markdown);
  const directory = fs.mkdtempSync(
    path.join(os.tmpdir(), "pi-formula-protocol-"),
  );
  try {
    return run(tool, directory, markdown, expected);
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
}

process.exitCode = main();
