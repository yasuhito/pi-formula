const fs: typeof import("node:fs") = require("node:fs");
const path: typeof import("node:path") = require("node:path");
const {
  Markdown,
  TuiMainScreen,
}: typeof import("@earendil-works/pi-tui") = require("@earendil-works/pi-tui");

interface GraphicsCommand {
  controls: string;
  payload: string;
}
interface StreamingFrame {
  source: string;
  transformed: string;
  terminalLines: string[];
}
type FakePi = ReturnType<typeof import("../../test/support/fake-pi.js").fakePi>;
type MarkdownTheme = ConstructorParameters<typeof Markdown>[3];

const PLACEHOLDER = String.fromCodePoint(0x10eeee);
const SGR = /\x1b\[[0-9;:]*m/gu;

const REPRODUCTION_PARTS = [
  String.raw`N 次元の計算基底 $|x\rangle$（$x = 0, \dots, N-1$）に対して

$$
\mathrm{QFT}_N|x\rangle = \frac{1}{\sqrt{N}} \sum_{k=0}^{N-1} e^{2\pi i\, xk/N}\, |k\rangle
$$`,
  String.raw`重ね合わせに対しては線形に拡張する：

$$
\mathrm{QFT}_N \sum_x \alpha_x |x\rangle = \frac{1}{\sqrt{N}} \sum_{k=0}^{N-1} \left(\sum_x \alpha_x\, e^{2\pi i xk/N}\right) |k\rangle
$$`,
  String.raw`つまり、振幅ベクトル $\alpha$ に離散フーリエ変換（DFT）をユニタリに作用させたもの。位相 $\omega = e^{2\pi i/N}$ を使うと行列要素は

$$
F_N[j,k] = \frac{\omega^{jk}}{\sqrt{N}}
$$`,
  String.raw`逆変換は共役転置 $F_N^\dagger$（$\omega^{jk} \to \omega^{-jk}$）。

$$
F_8 = \frac{1}{\sqrt{8}}
\begin{pmatrix}
1 & 1 & 1 & 1 & 1 & 1 & 1 & 1 \\
1 & \omega & \omega^2 & \omega^3 & \omega^4 & \omega^5 & \omega^6 & \omega^7 \\
1 & \omega^2 & \omega^4 & \omega^6 & 1 & \omega^2 & \omega^4 & \omega^6 \\
1 & \omega^3 & \omega^6 & \omega & \omega^4 & \omega^7 & \omega^2 & \omega^5 \\
1 & \omega^4 & 1 & \omega^4 & 1 & \omega^4 & 1 & \omega^4 \\
1 & \omega^5 & \omega^2 & \omega^7 & \omega^4 & \omega & \omega^6 & \omega^3 \\
1 & \omega^6 & \omega^4 & \omega^2 & 1 & \omega^6 & \omega^4 & \omega^2 \\
1 & \omega^7 & \omega^6 & \omega^5 & \omega^4 & \omega^3 & \omega^2 & \omega
\end{pmatrix}
$$`,
];

function graphicsCommands(line: string): GraphicsCommand[] {
  return [...line.matchAll(/\x1b_G([^;]*);([^\x1b]*)\x1b\\/gu)].map(
    (match) => ({
      controls: match[1],
      payload: match[2],
    }),
  );
}

function controls(command: GraphicsCommand) {
  return new Map(
    command.controls.split(",").map((control) => {
      const [name, value] = control.split("=", 2);
      return [name, value] as const;
    }),
  );
}

function placeholderId(line: string) {
  const match = /\x1b\[38;2;(\d+);(\d+);(\d+)m\x1b\[58:2::\1:\2:\3m/u.exec(
    line,
  );
  if (!match || !line.includes(PLACEHOLDER)) return undefined;
  return (Number(match[1]) << 16) | (Number(match[2]) << 8) | Number(match[3]);
}

function chunksAreComplete(line: string, commands: GraphicsCommand[]) {
  const remainder = line
    .replace(/\x1b_G[^;]*;[^\x1b]*\x1b\\/gu, "")
    .replace(SGR, "")
    .trim();
  if (line.includes("\n") || commands.length === 0 || remainder !== "")
    return false;
  const chunkControls = commands.map(controls);
  if (
    chunkControls[0].get("a") !== "T" ||
    commands.some(({ payload }) => !payload)
  )
    return false;
  if (commands.length === 1) return !chunkControls[0].has("m");
  return (
    chunkControls[0].get("m") === "1" &&
    chunkControls.slice(1, -1).every((values) => values.get("m") === "1") &&
    chunkControls.at(-1)?.get("m") === "0"
  );
}

function inspectFrame(frame: StreamingFrame) {
  const transferLines = frame.terminalLines
    .map((line, index) => ({ line, index, commands: graphicsCommands(line) }))
    .filter(({ commands }) =>
      commands.some((command) => controls(command).get("a") === "T"),
    );
  const placeholders = frame.terminalLines
    .map((line, index) => ({ id: placeholderId(line), index }))
    .filter(({ id }) => id !== undefined);
  const transferIds = transferLines.map(({ commands }) =>
    Number(controls(commands[0]).get("i")),
  );

  return {
    transformedTransferCount: (
      frame.transformed.match(/\x1b_Ga=T,f=100/gu) ?? []
    ).length,
    transferLineCount: transferLines.length,
    oneTransferPerLine: transferLines.every(
      ({ commands }) =>
        commands.filter((command) => controls(command).get("a") === "T")
          .length === 1,
    ),
    completeChunks: transferLines.every(({ line, commands }) =>
      chunksAreComplete(line, commands),
    ),
    matchingPlacementIds: transferLines.every(({ commands }) => {
      const header = controls(commands[0]);
      return (
        header.get("i") !== undefined && header.get("i") === header.get("p")
      );
    }),
    matchingPlaceholderRows:
      transferLines.every(({ commands }) => {
        const header = controls(commands[0]);
        const id = Number(header.get("i"));
        return (
          placeholders.filter((placeholder) => placeholder.id === id).length ===
          Number(header.get("r"))
        );
      }) && placeholders.every(({ id }) => transferIds.includes(id ?? -1)),
    adjacentPlacements: transferLines.every(({ index, commands }) => {
      const id = Number(controls(commands[0]).get("i"));
      const placement = placeholders.find(
        (placeholder) => placeholder.id === id && placeholder.index > index,
      );
      if (!placement) return false;
      return frame.terminalLines
        .slice(index + 1, placement.index)
        .every(
          (line) =>
            !line.includes("\x1b_G") && line.replace(SGR, "").trim() === "",
        );
    }),
  };
}

function renderStreamingFrame(pi: FakePi, count: number): StreamingFrame {
  const passthroughTheme = new Proxy({} as MarkdownTheme, {
    get: () => (value: string) => value,
  });
  const source = REPRODUCTION_PARTS.slice(0, count).join("\n\n");
  const transformed = pi.transformer()(source, {
    messageType: "assistant",
    isStreaming: false,
    availableWidth: 80,
  });
  return {
    source,
    transformed,
    terminalLines: new Markdown(transformed, 0, 0, passthroughTheme).render(80),
  };
}

function inspectStreamingRegression(frames: StreamingFrame[]) {
  return frames.map(inspectFrame);
}

function renderMarkdown(markdown: string) {
  const passthroughTheme = new Proxy({} as MarkdownTheme, {
    get: () => (value: string) => value,
  });
  return new Markdown(markdown, 0, 0, passthroughTheme).render(80);
}

function inspectPlacementBlocks(markdown: string) {
  const lines = renderMarkdown(markdown);
  const blocks = [];
  for (let index = 0; index < lines.length; index += 1) {
    const id = placeholderId(lines[index]);
    if (id === undefined) continue;
    const start = index;
    while (placeholderId(lines[index + 1]) === id) index += 1;
    const rows = index - start + 1;
    let transferIndex = start - 1;
    while (
      transferIndex >= 0 &&
      !lines[transferIndex].includes("\x1b_G") &&
      lines[transferIndex].replace(SGR, "").trim() === ""
    ) {
      transferIndex -= 1;
    }
    const transferLine = lines[transferIndex] ?? "";
    const commands = graphicsCommands(transferLine);
    const header = commands[0] ? controls(commands[0]) : new Map();
    const between = lines.slice(transferIndex + 1, start);
    blocks.push({
      id,
      rows,
      transferId: Number(header.get("i")),
      declaredRows: Number(header.get("r")),
      completeTransfer: chunksAreComplete(transferLine, commands),
      adjacentTransfer: between.every(
        (line) =>
          !line.includes("\x1b_G") && line.replace(SGR, "").trim() === "",
      ),
    });
  }
  return blocks;
}

function tuiUpdates(precedingToolLines: string[]) {
  const writes: string[] = [];
  const terminal = {
    columns: 80,
    rows: 600,
    kittyProtocolActive: false,
    start() {},
    stop() {},
    async drainInput() {},
    write(value: string) {
      writes.push(value);
    },
    moveBy() {},
    hideCursor() {},
    showCursor() {},
    clearLine() {},
    clearFromCursor() {},
    clearScreen() {},
    setTitle() {},
    setProgress() {},
  };
  let lines = precedingToolLines;
  const content = { render: () => lines, invalidate() {} };
  const tui = new TuiMainScreen(terminal, false);
  tui.addChild(content);
  tui.start();
  const render = (markdown: string) => {
    const start = writes.length;
    lines = [...precedingToolLines, ...renderMarkdown(markdown)];
    tui.renderNow();
    return writes.slice(start).join("");
  };
  return { render, stop: () => tui.stop({ preserveScreen: true }) };
}

function issue26Source() {
  const corpus = fs.readFileSync(
    path.resolve(__dirname, "../../docs/agents/verify-corpus/issue-26.md"),
    "utf8",
  );
  const delimiters = [...corpus.matchAll(/^\$\$$/gmu)];
  const partials = delimiters
    .filter((_match, index) => index % 2 === 1)
    .map((match) => corpus.slice(0, match.index + match[0].length));
  return { corpus, partials };
}

function issue26Updates(pi: FakePi) {
  const { corpus, partials } = issue26Source();
  const transform = (source: string, isStreaming: boolean) =>
    pi.transformer()(source, {
      messageType: "assistant",
      isStreaming,
      availableWidth: 80,
    });
  const precedingToolLines = ["qni tool call", "qni tool result"];
  const streaming = partials.map((source) => transform(source, true));
  const finalized = transform(corpus, false);
  const tui = tuiUpdates(precedingToolLines);
  try {
    return {
      precedingToolLines,
      streaming,
      finalized,
      tuiWrites: {
        initial: tui.render(""),
        streaming: streaming.map(tui.render),
        finalized: tui.render(finalized),
      },
    };
  } finally {
    tui.stop();
  }
}

module.exports = {
  inspectPlacementBlocks,
  inspectStreamingRegression,
  issue26Source,
  issue26Updates,
  renderStreamingFrame,
  tuiUpdates,
};
export type StreamingRegressionModule = {
  inspectPlacementBlocks: typeof inspectPlacementBlocks;
  inspectStreamingRegression: typeof inspectStreamingRegression;
  issue26Source: typeof issue26Source;
  issue26Updates: typeof issue26Updates;
  renderStreamingFrame: typeof renderStreamingFrame;
  tuiUpdates: typeof tuiUpdates;
};
