#!/usr/bin/env node
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const { resolveVtTool } = require("./vt-tool");

const root = path.resolve(__dirname, "..");
const corpusPath = path.join(root, "docs/agents/verify-corpus/issue-26.md");

function displayFormulaCount(markdown) {
  return (markdown.match(/^\$\$\s*$[\s\S]*?^\$\$\s*$/gmu) ?? []).length;
}

function sections(output, kind) {
  return output
    .split(/^== /mu)
    .slice(1)
    .filter(
      (section) =>
        section.startsWith(`${kind} `) || section.startsWith(`${kind} ==`),
    )
    .map((section) => section.slice(section.indexOf("\n") + 1));
}

function number(state, pattern) {
  return Number(pattern.exec(state)?.[1]);
}

function inspect(output, raw, expected) {
  const frames = sections(output, "frame");
  const completeFrames = frames.filter((frame) =>
    frame.includes("frame.complete=1"),
  );
  const final = sections(output, "final").at(-1) ?? "";
  const leaks = frames.map((frame) => number(frame, /cells\.apc_leak=(\d+)/u));
  const textFrames = completeFrames.filter(
    (frame) =>
      number(frame, /kitty\.placements=(\d+)/u) === 0 &&
      frame.includes(String.raw`\mathrm{QFT}_N`),
  );
  const fragmentedTransfers = frames.filter((frame) =>
    frame.includes("frame.kitty_open=1"),
  );
  const virtualImages = (
    final.match(/^placement: .* virtual=1 .* image=\{/gmu) ?? []
  ).length;
  const finalPlaceholderImages = new Set(
    [...final.matchAll(/^placeholder: image_id=(0x[0-9a-f]+)/gmu)].map(
      (match) => match[1],
    ),
  ).size;

  if (frames.length < 2) return "読み取りごとのフレームが記録されませんでした";
  if (textFrames.length !== expected)
    return `未完了本文の差分描画は ${expected} 回に対して ${textFrames.length} 回です`;
  if (completeFrames.some((frame) => !frame.includes("qni tool result")))
    return "差分描画で先行する tool 出力が失われました";
  if (raw.includes("\x1b[2J"))
    return "差分描画の途中で画面全体が消去されました";
  if (fragmentedTransfers.length === 0)
    return "読み取り境界をまたぐ Kitty APC を確認できませんでした";
  if (leaks.some((value) => value !== 0))
    return `本文セルに APC の断片があるフレームがあります: ${leaks.join(",")}`;
  if (virtualImages !== expected || finalPlaceholderImages !== expected)
    return (
      `最終フレームの表示数式 ${expected} 件に対して ` +
      `仮想配置 ${virtualImages} 件、placeholder の画像 ${finalPlaceholderImages} 件です`
    );
  return {
    fragmentedTransfers: fragmentedTransfers.length,
    frames: frames.length,
    streamingUpdates: textFrames.length,
    virtualImages,
  };
}

function run(tool, expected, configHome) {
  const rawPath = path.join(configHome, "streaming.raw");
  const result = spawnSync(
    tool,
    [
      "--cols",
      "80",
      "--rows",
      "600",
      "--settle-ms",
      "500",
      "--timeout-ms",
      "15000",
      "--wait-for-placements",
      String(expected),
      "--frames",
      "--raw",
      rawPath,
      "--",
      process.execPath,
      path.join(root, "scripts/streaming-protocol-fixture.js"),
    ],
    {
      cwd: root,
      encoding: "utf8",
      env: {
        ...process.env,
        XDG_CONFIG_HOME: configHome,
        PI_FORMULA_MACROS: "{}",
      },
      maxBuffer: 100 * 1024 * 1024,
      timeout: 20_000,
    },
  );
  if (result.error) {
    console.error(
      `ストリーミング中のプロトコル検査を実行できませんでした: ${result.error.message}`,
    );
    return 2;
  }
  if (result.signal || result.status !== 0) {
    process.stderr.write(result.stderr);
    return 2;
  }
  const inspected = inspect(
    result.stdout,
    fs.readFileSync(rawPath, "utf8"),
    expected,
  );
  if (typeof inspected === "string") {
    console.error(inspected);
    return 1;
  }
  console.log(`streaming-protocol: frames=${inspected.frames}`);
  console.log(
    `streaming-protocol: streaming_updates=${inspected.streamingUpdates} preceding_tool=preserved full_clears=0`,
  );
  console.log(
    `streaming-protocol: fragmented_transfers=${inspected.fragmentedTransfers}`,
  );
  console.log("streaming-protocol: apc_leak=0");
  console.log(
    `streaming-protocol: final display_formulas=${expected} virtual_images=${inspected.virtualImages}`,
  );
  return 0;
}

function main() {
  const tool = resolveVtTool();
  if (!tool) {
    console.log(
      "SKIP: ストリーミング中のプロトコル検査（vt-pty がありません）",
    );
    return 0;
  }
  const expected = displayFormulaCount(fs.readFileSync(corpusPath, "utf8"));
  const directory = fs.mkdtempSync(
    path.join(os.tmpdir(), "pi-formula-streaming-protocol-"),
  );
  try {
    return run(tool, expected, directory);
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
}

process.exitCode = main();
