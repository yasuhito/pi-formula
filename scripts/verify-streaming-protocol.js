#!/usr/bin/env node
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const { resolveVtTool } = require("./vt-tool");

const root = path.resolve(__dirname, "..");
const corpusPath = path.join(root, "docs/agents/verify-corpus/issue-26.md");
const expectedStreamingUpdates = 3;

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

function imageIds(state, pattern) {
  return new Set([...state.matchAll(pattern)].map((match) => match[1]));
}

function placementImageIds(state) {
  return imageIds(
    state,
    /^placement: image_id=(0x[0-9a-f]+).* virtual=1 .* image=\{/gmu,
  );
}

function placeholderImageIds(state) {
  return imageIds(state, /^placeholder: image_id=(0x[0-9a-f]+)/gmu);
}

function sameValues(left, right) {
  return (
    left.size === right.size && [...left].every((value) => right.has(value))
  );
}

function virtualImageCount(state) {
  return (state.match(/^placement: .* virtual=1 .* image=\{/gmu) ?? []).length;
}

function inspect(output, raw, displayFormulas) {
  const frames = sections(output, "frame");
  const completeFrames = frames.filter((frame) =>
    frame.includes("frame.complete=1"),
  );
  const final = sections(output, "final").at(-1) ?? "";
  const leaks = frames.map((frame) => number(frame, /cells\.apc_leak=(\d+)/u));
  const fragmentedTransfers = frames.filter((frame) =>
    frame.includes("frame.kitty_open=1"),
  );
  const unmatchedFrames = completeFrames.filter(
    (frame) =>
      !sameValues(placementImageIds(frame), placeholderImageIds(frame)),
  );
  const virtualImages = virtualImageCount(final);
  const streamingUpdates = Math.max(0, completeFrames.length - 2);

  if (frames.length < 2) return "読み取りごとのフレームが記録されませんでした";
  if (streamingUpdates !== expectedStreamingUpdates)
    return `ストリーミング更新は ${expectedStreamingUpdates} 回に対して ${streamingUpdates} 回です`;
  if (completeFrames.some((frame) => !frame.includes("qni tool result")))
    return "差分描画で先行する tool 出力が失われました";
  if (raw.includes("\x1b[2J"))
    return "差分描画の途中で画面全体が消去されました";
  if (fragmentedTransfers.length === 0)
    return "読み取り境界をまたぐ Kitty APC を確認できませんでした";
  if (leaks.some((value) => value !== 0))
    return `本文セルに APC の断片があるフレームがあります: ${leaks.join(",")}`;
  if (unmatchedFrames.length > 0)
    return `${unmatchedFrames.length} 件の完了フレームで仮想配置と placeholder が対応しません`;
  if (virtualImages !== displayFormulas)
    return (
      `最終フレームの表示数式 ${displayFormulas} 件に対して ` +
      `仮想配置 ${virtualImages} 件です`
    );
  return {
    completeFrames: completeFrames.length,
    fragmentedTransfers: fragmentedTransfers.length,
    frames: frames.length,
    streamingUpdates,
    virtualImages,
  };
}

function run(tool, displayFormulas, configHome) {
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
      String(displayFormulas),
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
    displayFormulas,
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
  console.log(
    `streaming-protocol: complete_frames=${inspected.completeFrames} placement_placeholders=matched`,
  );
  console.log("streaming-protocol: apc_leak=0");
  console.log(
    `streaming-protocol: final display_formulas=${displayFormulas} virtual_images=${inspected.virtualImages}`,
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
  const displayFormulas = displayFormulaCount(
    fs.readFileSync(corpusPath, "utf8"),
  );
  const directory = fs.mkdtempSync(
    path.join(os.tmpdir(), "pi-formula-streaming-protocol-"),
  );
  try {
    return run(tool, displayFormulas, directory);
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
}

process.exitCode = main();
