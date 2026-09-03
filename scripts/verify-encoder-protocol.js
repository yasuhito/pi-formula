#!/usr/bin/env node
const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { resolveVtTool } = require("./vt-tool");
const { fakePi, startWithKitty } = require("../test/support/fake-pi");

const root = path.resolve(__dirname, "..");
const markdown = String.raw`$$\begin{pmatrix}1&0\\0&1\end{pmatrix}$$`;
const standardChecks = [
  "storage",
  "placement",
  "image-id",
  "coordinates",
  "underline",
  "cached",
];
const checks = new Set([...standardChecks, "missing-transfer"]);

function option(name) {
  const index = process.argv.indexOf(name);
  return index < 0 ? undefined : process.argv[index + 1];
}

function controlValue(control, name) {
  return new RegExp(`(?:^|,)${name}=([^,]+)`, "u").exec(control)?.[1];
}

function kittyCommandPattern() {
  // biome-ignore lint/complexity/useRegexLiterals: 制御文字を含む正規表現リテラルは lint が拒否する。
  return new RegExp("\\x1b_G([^;]*);([A-Za-z0-9+/=]*)\\x1b\\\\", "gu");
}

function transferPlan(encoded) {
  const commands = [...encoded.matchAll(kittyCommandPattern())];
  const firstIndex = commands.findIndex(
    (command) => controlValue(command[1], "a") === "T",
  );
  if (firstIndex < 0) throw new Error("画像転送の計画がありません");
  const first = commands[firstIndex];
  let payload = "";
  for (let index = firstIndex; index < commands.length; index += 1) {
    payload += commands[index][2];
    if (controlValue(commands[index][1], "m") !== "1") break;
  }
  const png = Buffer.from(payload, "base64");
  if (
    png.length < 24 ||
    !png.subarray(0, 4).equals(Buffer.from([137, 80, 78, 71]))
  ) {
    throw new Error("画像転送の payload が PNG ではありません");
  }
  return {
    id: Number(controlValue(first[1], "i")),
    format: Number(controlValue(first[1], "f")),
    columns: Number(controlValue(first[1], "c")),
    rows: Number(controlValue(first[1], "r")),
    width: png.readUInt32BE(16),
    height: png.readUInt32BE(20),
  };
}

async function withIsolatedFormulaEnvironment(task) {
  const names = ["TMUX", "TERM", "XDG_CONFIG_HOME", "PI_FORMULA_MACROS"];
  const original = new Map(names.map((name) => [name, process.env[name]]));
  const configHome = fs.mkdtempSync(
    path.join(os.tmpdir(), "pi-formula-encoder-config-"),
  );
  delete process.env.TMUX;
  process.env.TERM = "xterm-ghostty";
  process.env.XDG_CONFIG_HOME = configHome;
  process.env.PI_FORMULA_MACROS = "{}";
  try {
    return await task();
  } finally {
    for (const [name, value] of original) {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
    fs.rmSync(configHome, { recursive: true, force: true });
  }
}

function encoderOutputs() {
  return withIsolatedFormulaEnvironment(async () => {
    const pi = fakePi();
    require("../dist/extension.js").default(pi.api);
    await startWithKitty(pi);
    const render = () =>
      pi.transformer()(markdown, {
        messageType: "assistant",
        isStreaming: false,
        availableWidth: 80,
      });
    return [render(), render()];
  });
}

function runVt(tool, encoded, waitForPlacement = true) {
  const child = 'process.stdout.write(Buffer.from(process.argv[1], "base64"))';
  const result = spawnSync(
    tool,
    [
      "--cols",
      "120",
      "--rows",
      "40",
      "--settle-ms",
      "20",
      "--timeout-ms",
      "5000",
      ...(waitForPlacement ? ["--wait-for-placements", "1"] : []),
      "--",
      process.execPath,
      "-e",
      child,
      Buffer.from(encoded).toString("base64"),
    ],
    {
      cwd: root,
      encoding: "utf8",
      timeout: 10_000,
      maxBuffer: 10 * 1024 * 1024,
    },
  );
  if (result.error) throw result.error;
  if (result.signal || result.status !== 0) {
    throw new Error(
      result.stderr.trim() ||
        `vt-pty が終了コード ${result.status} で失敗しました`,
    );
  }
  return result.stdout;
}

function protocolState(output) {
  const placements = [
    ...output.matchAll(
      /^placement: image_id=0x([0-9a-f]+) placement_id=0x[0-9a-f]+ virtual=(\d+) cols=(\d+) rows=(\d+) z=-?\d+(?: image=\{(\d+)x(\d+) format=(\d+) bytes=(\d+)\}| image=MISSING)$/gmu,
    ),
  ].map((match) => ({
    imageId: Number.parseInt(match[1], 16),
    virtual: match[2] === "1",
    columns: Number(match[3]),
    rows: Number(match[4]),
    width: Number(match[5]),
    height: Number(match[6]),
    format: Number(match[7]),
    bytes: Number(match[8]),
  }));
  const placeholders = [
    ...output.matchAll(
      /^placeholder: image_id=0x([0-9a-f]+) row=(-?\d+) col=(-?\d+) fg=rgb\((\d+),(\d+),(\d+)\) underline_color=(\w+)$/gmu,
    ),
  ].map((match) => ({
    imageId: Number.parseInt(match[1], 16),
    row: Number(match[2]),
    column: Number(match[3]),
    foregroundId:
      (Number(match[4]) << 16) | (Number(match[5]) << 8) | Number(match[6]),
    underline: match[7],
  }));
  return { placements, placeholders };
}

function sameValues(actual, expected) {
  return JSON.stringify(actual) === JSON.stringify(expected);
}

function problemFor(check, plan, state) {
  const placement = state.placements[0];
  if (check === "missing-transfer") {
    const ids = new Set(
      state.placements
        .filter((item) => item.virtual)
        .map((item) => item.imageId),
    );
    return state.placeholders.some((cell) => !ids.has(cell.foregroundId))
      ? "placeholder が指す id に仮想配置がない"
      : undefined;
  }
  if (check === "storage" || check === "cached") {
    const actual = state.placements.filter((item) => item.imageId === plan.id);
    return actual.length === 1 &&
      plan.format === 100 &&
      actual[0].format === 1 &&
      actual[0].width === plan.width &&
      actual[0].height === plan.height
      ? undefined
      : `storage の画像が計画と一致しない: ${JSON.stringify({ plan, actual })}`;
  }
  if (check === "placement") {
    return placement?.imageId === plan.id &&
      placement.virtual &&
      placement.columns === plan.columns &&
      placement.rows === plan.rows
      ? undefined
      : "仮想配置が計画と一致しない";
  }
  if (check === "image-id") {
    return state.placeholders.length > 0 &&
      state.placeholders.every((cell) => cell.foregroundId === plan.id)
      ? undefined
      : "foreground RGB の画像 id が計画と一致しない";
  }
  if (check === "coordinates") {
    const expected = Array.from({ length: plan.rows }, (_, row) =>
      Array.from({ length: plan.columns }, (_unused, column) => ({
        row,
        column,
      })),
    ).flat();
    const actual = state.placeholders.map(({ row, column }) => ({
      row,
      column,
    }));
    return sameValues(actual, expected)
      ? undefined
      : "placeholder の座標が計画と一致しない";
  }
  if (check === "underline") {
    return state.placeholders.length > 0 &&
      state.placeholders.every((cell) => cell.underline === "rgb")
      ? undefined
      : "placeholder の underline_color タグが RGB ではない";
  }
  return `未知の検査です: ${check}`;
}

function executeCheck(tool, check, outputs) {
  const encoded = check === "cached" ? outputs[1] : outputs[0];
  const plan = transferPlan(encoded);
  const bytes =
    check === "missing-transfer"
      ? encoded.replace(kittyCommandPattern(), "")
      : encoded;
  const state = protocolState(runVt(tool, bytes, check !== "missing-transfer"));
  return problemFor(check, plan, state);
}

async function main() {
  const requested = option("--check");
  if (requested !== undefined && !checks.has(requested)) {
    console.error(
      "Usage: verify-encoder-protocol.js [--check <storage|placement|image-id|coordinates|underline|cached|missing-transfer>]",
    );
    return 2;
  }
  const tool = resolveVtTool();
  if (!tool) {
    console.log("SKIP: エンコーダ層のプロトコル検査（vt-pty がありません）");
    return 0;
  }
  const outputs = await encoderOutputs();
  for (const check of requested ? [requested] : standardChecks) {
    const problem = executeCheck(tool, check, outputs);
    if (problem) {
      console.error(problem);
      return 1;
    }
    console.log(`encoder-protocol: ${check} ok`);
  }
  return 0;
}

main()
  .then((status) => {
    process.exitCode = status;
  })
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 2;
  });
