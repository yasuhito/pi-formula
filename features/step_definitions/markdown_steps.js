const assert = require("node:assert/strict");
const childProcess = require("node:child_process");
const fs = require("node:fs");
const http = require("node:http");
const https = require("node:https");
const net = require("node:net");
const { resolve } = require("node:path");
const { Given, Then, When } = require("@cucumber/cucumber");

const registerFormula = require("../../dist/extension.js").default;
const {
  inspectPlacementBlocks,
  inspectStreamingRegression,
  issue26Updates,
  renderStreamingRegression,
} = require("../support/streaming-regression");
const { fakePi, startWithKitty } = require("../../test/support/fake-pi");
const PLACEHOLDER = String.fromCodePoint(0x10eeee);

function transform(world, markdown, options = {}) {
  world.source = markdown;
  world.rendered = world.pi.transformer()(markdown, {
    messageType: options.messageType ?? "assistant",
    isStreaming: options.isStreaming ?? false,
    availableWidth: 80,
  });
}

function placeholderLines(markdown) {
  return markdown.split("\n").filter((line) => line.includes(PLACEHOLDER));
}

function imageCount(markdown) {
  return (markdown.match(/\x1b_Ga=T,f=100/gu) ?? []).length;
}

function cacheImage(bytes) {
  return {
    svg: "s".repeat(bytes),
    png: Buffer.alloc(bytes),
    scale: 1,
    widthPx: 1,
    heightPx: 1,
    columns: 1,
    rows: 1,
  };
}

Given("画像経路で数式を描ける Pi がある", async function () {
  this.pi = fakePi();
  registerFormula(this.pi.api);
  this.started = await startWithKitty(this.pi);
});

When("4 種類の数式区切りを含む本文を変換する", function () {
  transform(this, "$x$ と $$y$$ と \\(z\\) と \\[w\\]");
});

When("コードフェンスと文中コードに数式がある本文を変換する", function () {
  transform(
    this,
    [
      "```text",
      "$$fenced$$",
      "```",
      "`$$inline$$`",
      "- ```text",
      "  $$listed$$",
      "  ```",
    ].join("\n"),
  );
});

When("長い区切りと字下げと末尾空白を持つコードフェンスを変換する", function () {
  transform(
    this,
    [
      "```text",
      "$$backtick$$",
      "````  \t",
      "   ~~~~text",
      "   $$tilde$$",
      "   ~~~~~   ",
      "$$x+1$$",
    ].join("\n"),
  );
});

When("正規表現メタ文字を含む行があるコードフェンスを変換する", function () {
  transform(
    this,
    [
      "```text",
      "```.*",
      "$$afterBacktickMetacharacters$$",
      "```",
      "~~~text",
      "~~~[a-z]+",
      "$$afterTildeMetacharacters$$",
      "~~~",
      "$$x+1$$",
    ].join("\n"),
  );
});

When("thinking の本文を変換する", function () {
  transform(this, "考える: $$x$$", { messageType: "assistant-thinking" });
});

When(
  "金額と URL とシェル変数とエスケープ済みドル記号を含む本文を変換する",
  function () {
    transform(
      this,
      [
        "It costs $5 or $10. https://example.com/$5 uses $HOME and \\$5.",
        "Keep https://example.com/$$x$$/page and run echo $$; kill $$ safely.",
      ].join("\n"),
    );
  },
);

When("曖昧なドル記号を含む本文を変換する", function () {
  transform(this, "The values are $first and $second, not a formula.");
});

When("箇条書き内の表示数式を変換する", function () {
  transform(this, "- 外側\n  - 式: $$\n    x^2\n    $$");
});

When("引用内の表示数式を変換する", function () {
  transform(this, "> 式: \\[\n> x^2\n> \\]");
});

When("閉じた数式まで届いたストリーミング本文を変換する", function () {
  transform(this, "途中\n$$x$$\n続き", { isStreaming: true });
});

When("未完成な数式まで届いたストリーミング本文を変換する", function () {
  transform(this, "途中\n$$\\frac{1}{2}", { isStreaming: true });
});

When("不正な表示数式と正しい表示数式を含む本文を変換する", function () {
  transform(this, "$$\\notacommand{$$\n次の本文\n$$x$$");
});

Then("インライン数式は残り、2 つの表示数式だけが画像になる", function () {
  assert.deepEqual(
    {
      inlineDollar: this.rendered.includes("$x$"),
      inlineParentheses: this.rendered.includes("\\(z\\)"),
      imageCount: imageCount(this.rendered),
    },
    { inlineDollar: true, inlineParentheses: true, imageCount: 2 },
  );
});

Then("コード内の本文は変更されない", function () {
  assert.equal(this.rendered, this.source);
});

Then(
  "2 種類のコードフェンスが閉じて後続の表示数式だけが画像になる",
  function () {
    assert.deepEqual(
      {
        backtickFormulaRemains: this.rendered.includes("$$backtick$$"),
        tildeFormulaRemains: this.rendered.includes("$$tilde$$"),
        imageCount: imageCount(this.rendered),
      },
      {
        backtickFormulaRemains: true,
        tildeFormulaRemains: true,
        imageCount: 1,
      },
    );
  },
);

Then("正規表現メタ文字を含む行の後もコード内の表示数式は残る", function () {
  assert.deepEqual(
    {
      backtickFormulaRemains: this.rendered.includes(
        "$$afterBacktickMetacharacters$$",
      ),
      tildeFormulaRemains: this.rendered.includes(
        "$$afterTildeMetacharacters$$",
      ),
      imageCount: imageCount(this.rendered),
    },
    {
      backtickFormulaRemains: true,
      tildeFormulaRemains: true,
      imageCount: 1,
    },
  );
});

Then("thinking の本文は変更されない", function () {
  assert.equal(this.rendered, this.source);
});

Then("通常のドル記号を含む本文は変更されない", function () {
  assert.equal(this.rendered, this.source);
});

Then("曖昧なドル記号を含む本文は変更されない", function () {
  assert.equal(this.rendered, this.source);
});

Then("画像は箇条書きの字下げに残る", function () {
  assert.equal(placeholderLines(this.rendered)[0]?.startsWith("    "), true);
});

Then("画像は引用の階層に残る", function () {
  assert.equal(placeholderLines(this.rendered)[0]?.startsWith("> "), true);
});

Then("閉じた表示数式は原文のまま残る", function () {
  assert.equal(this.rendered, this.source);
});

Then("未完成な数式は原文のまま残る", function () {
  assert.equal(this.rendered, this.source);
});

Then("不正な数式は残り、正しい数式だけが画像になる", function () {
  assert.deepEqual(
    {
      invalidRemains: this.rendered.includes("$$\\notacommand{$$"),
      followingTextRemains: this.rendered.includes("次の本文"),
      imageCount: imageCount(this.rendered),
    },
    { invalidRemains: true, followingTextRemains: true, imageCount: 1 },
  );
});

Given("pi-formula の画像処理設定を読む", function () {
  this.safetyLimits = require("../../dist/typesetter.js").FORMULA_SAFETY_LIMITS;
});

When("固定上限を確認する", function () {
  this.limitValues = Object.values(this.safetyLimits ?? {});
});

Then(
  "入力文字数、画像列数・行数、既成PNGのバイト数・ピクセル数、一時保存件数・バイト数が有限の正数である",
  function () {
    assert.deepEqual(
      {
        names: Object.keys(this.safetyLimits ?? {}).sort(),
        allFinitePositiveIntegers: this.limitValues.every(
          (value) => Number.isSafeInteger(value) && value > 0,
        ),
      },
      {
        names: [
          "cacheBytes",
          "cacheEntries",
          "imageColumns",
          "imageRows",
          "latexCharacters",
          "pngBytes",
          "pngPixels",
        ],
        allFinitePositiveIntegers: true,
      },
    );
  },
);

When("上限を超えた表示数式と正しい表示数式を変換する", function () {
  const limits = require("../../dist/typesetter.js").FORMULA_SAFETY_LIMITS;
  this.oversizedLatex = `x${" ".repeat(limits.latexCharacters)}`;
  this.tooTallLatex = `\\begin{aligned}${Array.from(
    { length: limits.imageRows + 1 },
    (_, index) => `x_{${index}}`,
  ).join("\\\\")}\\end{aligned}`;
  transform(
    this,
    `$$${this.oversizedLatex}$$\n$$${this.tooTallLatex}$$\n$$x+7$$`,
  );
});

Then("上限を超えた数式は残り、正しい数式だけが画像になる", function () {
  assert.deepEqual(
    {
      oversizedRemains: this.rendered.includes(this.oversizedLatex),
      tooTallRemains: this.rendered.includes(this.tooTallLatex),
      imageCount: imageCount(this.rendered),
    },
    { oversizedRemains: true, tooTallRemains: true, imageCount: 1 },
  );
});

When("基準の半分より小さくなる表示数式と正しい表示数式を変換する", function () {
  this.smallLatex = Array.from(
    { length: 80 },
    (_, index) => `x_{${index}}`,
  ).join("+");
  this.source = `$$${this.smallLatex}$$\n$$y+7$$`;
  this.rendered = this.pi.transformer()(this.source, {
    messageType: "assistant",
    isStreaming: false,
    availableWidth: 8,
  });
});

Then("小さくなりすぎる数式は残り、正しい数式だけが画像になる", function () {
  assert.deepEqual(
    {
      smallRemains: this.rendered.includes(this.smallLatex),
      imageCount: imageCount(this.rendered),
    },
    { smallRemains: true, imageCount: 1 },
  );
});

When("同じ表示数式のテーマ色だけと表示幅だけを変えて変換する", function () {
  const formula = "$$x_{theme-width}$$";
  const render = (availableWidth) =>
    this.pi.transformer()(formula, {
      messageType: "assistant",
      isStreaming: false,
      availableWidth,
    });
  const baseline = render(80);
  this.started.setTextColor("\x1b[38;2;10;20;30m");
  const colorOnly = render(80);
  this.started.setTextColor("\x1b[38;2;212;212;212m");
  const widthOnly = render(40);
  this.imageIdentities = [baseline, colorOnly, widthOnly].map(
    (rendered) => /\bi=(\d+)/u.exec(rendered)?.[1],
  );
});

Then("テーマ色と表示幅の各変更が別の一時保存項目になる", function () {
  assert.equal(
    this.imageIdentities.every(Boolean) &&
      new Set(this.imageIdentities).size === 3,
    true,
  );
});

Given("正確な RGB を返さない画像経路の Pi がある", async function () {
  this.pi = fakePi();
  registerFormula(this.pi.api);
  await startWithKitty(this.pi, { foregroundAnsi: "\x1b[38;5;250m" });
});

When("表示数式を変換する", function () {
  transform(this, "$$x_{rgb}$$");
});

Then("RGB を得られない数式は原文のまま残る", function () {
  assert.equal(this.rendered, this.source);
});

Given("件数上限が3件の画像一時保存がある", function () {
  const { RenderCache } = require("../../dist/render-cache.js");
  this.renderCache = new RenderCache(3, 10_000);
  this.cacheCreates = new Map();
});

When("4件を保存して2件目を再利用する", function () {
  const get = (key) =>
    this.renderCache.getOrCreate(key, () => {
      this.cacheCreates.set(key, (this.cacheCreates.get(key) ?? 0) + 1);
      return cacheImage(20);
    });
  get("a");
  get("b");
  get("c");
  get("b");
  get("d");
  get("a");
  this.cacheStats = this.renderCache.stats();
});

Then("最も長く使っていない項目が退避され件数上限内に残る", function () {
  assert.deepEqual(
    {
      recreatedOldest: this.cacheCreates.get("a"),
      reusedSecond: this.cacheCreates.get("b"),
      entriesWithinLimit: this.cacheStats.entries <= 3,
    },
    { recreatedOldest: 2, reusedSecond: 1, entriesWithinLimit: true },
  );
});

Given("バイト上限が300バイトの画像一時保存がある", function () {
  const { RenderCache } = require("../../dist/render-cache.js");
  this.renderCache = new RenderCache(10, 300);
  this.cacheCreates = new Map();
});

When("バイト上限を超える画像を順に保存する", function () {
  const get = (key) =>
    this.renderCache.getOrCreate(key, () => {
      this.cacheCreates.set(key, (this.cacheCreates.get(key) ?? 0) + 1);
      return cacheImage(80);
    });
  get("a");
  get("b");
  get("a");
  this.cacheStats = this.renderCache.stats();
});

Then("最も長く使っていない項目が退避されバイト上限内に残る", function () {
  assert.deepEqual(
    {
      recreatedOldest: this.cacheCreates.get("a"),
      entries: this.cacheStats.entries,
      bytesWithinLimit: this.cacheStats.bytes <= 300,
    },
    { recreatedOldest: 2, entries: 1, bytesWithinLimit: true },
  );
});

Given("画像結果を作る回数を数えられる一時保存がある", function () {
  const { RenderCache } = require("../../dist/render-cache.js");
  this.renderCache = new RenderCache(3, 300);
  this.failedCreates = 0;
});

When("同じ失敗項目を二回取得する", function () {
  const fail = () => {
    this.failedCreates += 1;
    throw new Error("invalid LaTeX");
  };
  this.renderCache.getOrCreate("failure", fail);
  this.renderCache.getOrCreate("failure", fail);
});

Then("同じ失敗項目の画像処理は一回だけになる", function () {
  assert.equal(this.failedCreates, 1);
});

When(
  "通常本文とインライン数式と大きな行列を含む再現本文を逐次描画する",
  function () {
    this.streamingFormulaFrames = renderStreamingRegression(this.pi);
  },
);

Then(
  "各画像の転送チャンク列は他の描画出力を含まず配置まで完結する",
  function () {
    const expected = [1, 2, 3, 4].map((imageCount) => ({
      transformedTransferCount: imageCount,
      transferLineCount: imageCount,
      oneTransferPerLine: true,
      completeChunks: true,
      matchingPlacementIds: true,
      matchingPlaceholderRows: true,
      adjacentPlacements: true,
    }));
    assert.deepEqual(
      inspectStreamingRegression(this.streamingFormulaFrames),
      expected,
    );
  },
);

When(
  "先行するツール描画後にIssue 26の異なる3式を逐次更新して確定する",
  function () {
    require("../../dist/api.js").registerFormula(this.pi.api, {
      ket: [String.raw`\left|#1\right\rangle`, 1],
    });
    this.issue26Updates = issue26Updates(this.pi);
  },
);

Then("逐次更新中は文字を保ち確定後に3式の転送と配置が対応する", function () {
  const blocks = inspectPlacementBlocks(this.issue26Updates.finalized);
  assert.deepEqual(
    {
      precedingToolDrawn:
        this.issue26Updates.tuiWrites.initial.includes("qni tool result"),
      streamingImages: this.issue26Updates.streaming.map(imageCount),
      streamingTuiImages:
        this.issue26Updates.tuiWrites.streaming.map(imageCount),
      finalizedTuiImages: imageCount(this.issue26Updates.tuiWrites.finalized),
      placements: blocks.length,
      multipleRows: blocks.some((block) => block.rows > 1),
      matching: blocks.every(
        (block) =>
          block.id === block.transferId &&
          block.rows === block.declaredRows &&
          block.completeTransfer &&
          block.adjacentTransfer,
      ),
    },
    {
      precedingToolDrawn: true,
      streamingImages: [0, 0, 0],
      streamingTuiImages: [0, 0, 0],
      finalizedTuiImages: 3,
      placements: 3,
      multipleRows: true,
      matching: true,
    },
  );
});

When("同じ複数行表示数式を一回の確定応答内に二回配置する", function () {
  const formula = String.raw`$$\begin{pmatrix}1&0\\0&1\end{pmatrix}$$`;
  transform(this, [formula, "端末上の画像を破棄", formula].join("\n\n"));
  this.cachedPlacementBlocks = inspectPlacementBlocks(this.rendered);
});

Then("各配置で同じ画像IDの複数行転送とプレースホルダーが対応する", function () {
  const [first, second] = this.cachedPlacementBlocks;
  assert.equal(
    this.cachedPlacementBlocks.length === 2 &&
      first.id === second.id &&
      this.cachedPlacementBlocks.every(
        (block) =>
          block.rows > 1 &&
          block.id === block.transferId &&
          block.rows === block.declaredRows &&
          block.completeTransfer &&
          block.adjacentTransfer,
      ),
    true,
  );
});

When("外部作用を監視しながら表示数式を変換する", function () {
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
  try {
    transform(this, "$$x_{memory-only}+11$$");
  } finally {
    globalThis.fetch = originalFetch;
    for (const restore of patches.reverse()) restore();
  }
  this.externalCalls = calls;
  this.browserModules = Object.keys(require.cache).filter((path) =>
    /playwright|puppeteer/iu.test(path),
  );
});

Then(
  "SVGとPNGの保存、ネットワーク、ブラウザ、子プロセスを使わない",
  function () {
    assert.deepEqual(
      {
        externalCalls: this.externalCalls,
        browserModules: this.browserModules,
        renderedAsImage: imageCount(this.rendered),
      },
      { externalCalls: [], browserModules: [], renderedAsImage: 1 },
    );
  },
);

Given("pi-formula を新しい Node.js プロセスで読み込む", function () {
  this.projectRoot = resolve(__dirname, "../..");
});

When("入力上限を超えた表示数式を変換する", function () {
  const script = `
    const crypto = require('node:crypto');
    let keyCreations = 0;
    crypto.createHash = () => { keyCreations += 1; throw new Error('unexpected key creation'); };
    const loaded = () => Object.keys(require.cache).some((path) =>
      path.includes('@mathjax/src') || path.includes('@resvg/resvg-js'));
    const registerFormula = require('./dist/extension.js').default;
    const { FORMULA_SAFETY_LIMITS } = require('./dist/typesetter.js');
    const { fakePi, startWithKitty } = require('./test/support/fake-pi.js');
    (async () => {
      const pi = fakePi(); registerFormula(pi.api); await startWithKitty(pi);
      const latex = 'x'.repeat(FORMULA_SAFETY_LIMITS.latexCharacters + 1);
      const source = '$$' + latex + '$$';
      const rendered = pi.transformer()(source, {
        messageType: 'assistant', isStreaming: false, availableWidth: 80
      });
      process.stdout.write(JSON.stringify({ keyCreations, prepared: loaded(), unchanged: rendered === source }));
    })().catch((error) => { console.error(error); process.exitCode = 1; });
  `;
  const result = childProcess.spawnSync(process.execPath, ["-e", script], {
    cwd: this.projectRoot,
    encoding: "utf8",
  });
  if (result.status !== 0) throw new Error(result.stderr);
  this.oversizedPreparation = JSON.parse(result.stdout);
});

Then("鍵作成と画像処理へ進まない", function () {
  assert.deepEqual(this.oversizedPreparation, {
    keyCreations: 0,
    prepared: false,
    unchanged: true,
  });
});

When("表示数式を初めて変換する", function () {
  const script = `
    const loaded = () => Object.keys(require.cache).some((path) =>
      path.includes('@mathjax/src') || path.includes('@resvg/resvg-js'));
    const registerFormula = require('./dist/extension.js').default;
    const { fakePi, startWithKitty } = require('./test/support/fake-pi.js');
    const before = loaded();
    (async () => {
      const pi = fakePi(); registerFormula(pi.api); await startWithKitty(pi);
      const afterSessionStart = loaded();
      pi.transformer()('$$x_{lazy}$$', {
        messageType: 'assistant', isStreaming: false, availableWidth: 80
      });
      process.stdout.write(JSON.stringify({ before, afterSessionStart, afterFormula: loaded() }));
    })().catch((error) => { console.error(error); process.exitCode = 1; });
  `;
  const result = childProcess.spawnSync(process.execPath, ["-e", script], {
    cwd: this.projectRoot,
    encoding: "utf8",
  });
  if (result.status !== 0) throw new Error(result.stderr);
  this.lazyPreparation = JSON.parse(result.stdout);
});

Then("MathJaxとResvgは最初の表示数式で初めて準備される", function () {
  assert.deepEqual(this.lazyPreparation, {
    before: false,
    afterSessionStart: false,
    afterFormula: true,
  });
});

When(
  "初回準備後、異なる未キャッシュ数式と一時保存済み数式を複数回計測する",
  function () {
    const script = `
    const { performance } = require('node:perf_hooks');
    const registerFormula = require('./dist/extension.js').default;
    const { fakePi, startWithKitty } = require('./test/support/fake-pi.js');
    (async () => {
      const pi = fakePi(); registerFormula(pi.api); await startWithKitty(pi);
      const renderTimed = (latex) => {
        const started = performance.now();
        pi.transformer()('$$' + latex + '$$', {
          messageType: 'assistant', isStreaming: false, availableWidth: 80
        });
        return performance.now() - started;
      };
      renderTimed('x_{warmup}');
      const uncachedSamples = Array.from(
        { length: 5 },
        (_, index) => renderTimed('x_{cold' + (index + 1) + '}')
      );
      const cachedSamples = Array.from({ length: 10 }, () => renderTimed('x_{cold5}'));
      process.stdout.write(JSON.stringify({ uncachedSamples, cachedSamples }));
    })().catch((error) => { console.error(error); process.exitCode = 1; });
  `;
    const result = childProcess.spawnSync(process.execPath, ["-e", script], {
      cwd: resolve(__dirname, "../.."),
      encoding: "utf8",
    });
    if (result.status !== 0) throw new Error(result.stderr);
    this.durations = JSON.parse(result.stdout);
  },
);

Then(
  "一時保存済みの中央値は未キャッシュ中央値の5パーセント未満である",
  function () {
    const median = (samples) => {
      const sorted = [...samples].sort((left, right) => left - right);
      return sorted[Math.floor(sorted.length / 2)];
    };
    const uncachedMedian = median(this.durations.uncachedSamples);
    const cachedMedian = median(this.durations.cachedSamples);
    const cachedRatio = cachedMedian / uncachedMedian;
    assert.ok(
      this.durations.uncachedSamples.length === 5 &&
        this.durations.cachedSamples.length === 10 &&
        Number.isFinite(cachedRatio) &&
        cachedRatio < 0.05,
      JSON.stringify({
        ...this.durations,
        uncachedMedian,
        cachedMedian,
        cachedRatio,
      }),
    );
  },
);
