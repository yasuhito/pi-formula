import type { ExternalEffectsModule } from "../support/external-effects-monitor.js";
import type { RendererModule } from "../support/isolated-renderer.js";
import type { StreamingRegressionModule } from "../support/streaming-regression.js";

interface StepWorld {
  actualFormulaBeforeShellImages: string[];
  actualFormulaImages: string[];
  actualIndependentFormulaImages: string[];
  actualLabeledAmountFormulaImages: string[];
  actualLabeledNumericFormulaImages: string[];
  actualMultilineNumericFormulaImages: string[];
  actualNumericBeforeUnclosedImages: string[];
  actualNumericFormulaImages: string[];
  actualSeparatedFormulaImages: string[];
  blockKeyCreation: boolean | undefined;
  browserModules: string[];
  cacheCreates: Map<string, number>;
  cacheImageBytes: number;
  cacheStats: import("../../dist/render-cache.js").RenderCacheStats;
  cachedPlacementBlocks: ReturnType<typeof inspectPlacementBlocks>;
  durations: { uncachedSamples: number[]; cachedSamples: number[] };
  expectedFormulaBeforeShellImages: string[];
  expectedFormulaImages: string[];
  expectedIndependentFormulaImages: string[];
  expectedLabeledAmountFormulaImages: string[];
  expectedLabeledNumericFormulaImages: string[];
  expectedMultilineNumericFormulaImages: string[];
  expectedNumericBeforeUnclosedImages: string[];
  expectedNumericFormulaImages: string[];
  expectedSeparatedFormulaImages: string[];
  externalCalls: string[];
  failedCreates: number;
  imageIdentities: (string | undefined)[];
  isolatedRenderer: ReturnType<typeof isolatedRenderer>;
  issue26Source: ReturnType<typeof issue26Source>;
  issue26Tui: ReturnType<typeof tuiUpdates>;
  issue26Updates: {
    precedingToolLines?: string[];
    streaming: string[];
    finalized?: string;
    tuiWrites: { initial?: string; streaming: string[]; finalized?: string };
  };
  labeledAmount: string;
  lazyPreparation: {
    before: boolean;
    afterSessionStart?: boolean;
    afterFormula?: boolean;
  };
  limitValues: number[];
  oversizedLatex: string;
  oversizedPreparation: {
    keyCreations: number;
    prepared: boolean;
    unchanged: boolean;
  };
  pi: ReturnType<typeof fakePi>;
  referenceFollowingImages: string[];
  referenceNumericImages: string[];
  renderCache: import("../../dist/render-cache.js").RenderCache;
  rendered: string;
  safetyLimits: typeof import("../../dist/typesetter.js").FORMULA_SAFETY_LIMITS;
  scanDuration: number;
  smallLatex: string;
  source: string;
  started: Awaited<ReturnType<typeof startWithKitty>>;
  streamingFormulaFrames: ReturnType<typeof renderStreamingFrame>[];
  tableLines: string[];
  tooTallLatex: string;
  unicode: string;
}

// These callbacks run after the scenario's preparation fills the frame fields.
type FormulaFramesWorld = StepWorld & {
  issue26Updates: StepWorld["issue26Updates"] & { finalized: string };
};
type TuiFramesWorld = FormulaFramesWorld & {
  issue26Updates: {
    tuiWrites: { initial: string; streaming: string[]; finalized: string };
  };
};

const assert: typeof import("node:assert/strict") = require("node:assert/strict");
const {
  performance,
}: typeof import("node:perf_hooks") = require("node:perf_hooks");
const {
  After,
  Given,
  Then,
  When,
}: typeof import("@cucumber/cucumber") = require("@cucumber/cucumber");
const {
  Markdown,
  resetCapabilitiesCache,
  setCapabilityOverrides,
}: typeof import("@earendil-works/pi-tui") = require("@earendil-works/pi-tui");

const registerFormula: typeof import("../../dist/extension.js").default =
  require("../../dist/extension.js").default;
const {
  inspectPlacementBlocks,
  inspectStreamingRegression,
  issue26Source,
  renderStreamingFrame,
  tuiUpdates,
}: StreamingRegressionModule = require("../support/streaming-regression.js");
const {
  fakePi,
  startWithKitty,
}: typeof import("../../test/support/fake-pi") = require("../../test/support/fake-pi");
const {
  isolatedRenderer,
}: RendererModule = require("../support/isolated-renderer.js");
const {
  monitorExternalEffects,
}: ExternalEffectsModule = require("../support/external-effects-monitor.js");
const PLACEHOLDER = String.fromCodePoint(0x10eeee);

function transform(
  world: StepWorld,
  markdown: string,
  options: {
    messageType?: "assistant" | "assistant-thinking" | "user";
    isStreaming?: boolean;
  } = {},
) {
  world.source = markdown;
  world.rendered = world.pi.transformer()(markdown, {
    messageType: options.messageType ?? "assistant",
    isStreaming: options.isStreaming ?? false,
    availableWidth: 80,
  });
}

function placeholderLines(markdown: string) {
  return markdown.split("\n").filter((line) => line.includes(PLACEHOLDER));
}

function imageCount(markdown: string) {
  return (markdown.match(/\x1b_Ga=T,f=100/gu) ?? []).length;
}

function imageIdentities(markdown: string) {
  return Array.from(
    markdown.matchAll(/\x1b_Ga=T,f=100[^;]*\bi=(\d+)/gu),
    ([, identity]) => identity,
  );
}

function renderUnicode(markdown: string) {
  const passthroughTheme = new Proxy(
    {} as ConstructorParameters<typeof Markdown>[3],
    { get: () => (value: string) => value },
  );
  // 端末 capability の自動検出は実行中の端末の環境変数に従う。Ghostty の中で
  // 回すと URL が OSC 8 で包まれ、期待値が環境によって変わる。この検査は
  // 装飾の有無ではなく Unicode の文字列を見るので、capability を固定する。
  setCapabilityOverrides({ images: null, trueColor: true, hyperlinks: false });
  try {
    return new Markdown(markdown, 0, 0, passthroughTheme)
      .render(80)
      .map((line) => line.trimEnd())
      .join("\n");
  } finally {
    setCapabilityOverrides({});
    resetCapabilitiesCache();
  }
}

function cacheImage(bytes: number) {
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

Given("画像経路で数式を描ける Pi がある", async function (this: StepWorld) {
  this.pi = fakePi();
  registerFormula(this.pi.api);
  this.started = await startWithKitty(this.pi);
});

Given("ket と braket の追加マクロを登録する", function (this: StepWorld) {
  require("../../dist/api.js").registerFormula(this.pi.api, {
    ket: [String.raw`\left|#1\right\rangle`, 1],
    braket: [String.raw`\left\langle#1\right\rangle`, 1],
  });
});

Given(
  "braket の利用者マクロを設定した画像経路の Pi がある",
  async function (this: StepWorld) {
    process.env.PI_FORMULA_MACROS = JSON.stringify({
      braket: [String.raw`\left\langle#1\right\rangle`, 1],
    });
    this.pi = fakePi();
    registerFormula(this.pi.api);
    this.started = await startWithKitty(this.pi);
  },
);

Given(
  "空文字列の利用者マクロを設定した画像経路の Pi がある",
  async function (this: StepWorld) {
    process.env.PI_FORMULA_MACROS = JSON.stringify({ empty: "" });
    this.pi = fakePi();
    registerFormula(this.pi.api);
    this.started = await startWithKitty(this.pi);
  },
);

Given(
  "置換境界を確認する追加マクロを登録した画像経路の Pi がある",
  async function (this: StepWorld) {
    this.pi = fakePi();
    require("../../dist/api.js").registerFormula(this.pi.api, {
      ket: [String.raw`\left|#1\right\rangle`, 1],
      sq: ["#1^2", 1],
      groupedSq: ["{#1}^2", 1],
      alpha: String.raw`\alpha`,
      loop: String.raw`\loop`,
    });
    this.started = await startWithKitty(this.pi);
  },
);

When(
  "ket 追加マクロを含むドル区切りのインライン数式を描く",
  function (this: StepWorld) {
    transform(this, String.raw`$\ket{s}$`);
    this.unicode = renderUnicode(this.rendered);
  },
);

When("コロン直後の表示数式を変換する", function (this: StepWorld) {
  transform(this, "Result:$$x = 1$$");
});

When("コロン直後の ket 追加マクロを描く", function (this: StepWorld) {
  transform(this, String.raw`State:$\ket{s}$`);
  this.unicode = renderUnicode(this.rendered);
});

When(
  "URL 内のシェル変数と後続の ket 追加マクロを描く",
  function (this: StepWorld) {
    transform(this, String.raw`https://example.com/$HOME の後は $\ket{s}$`);
    this.unicode = renderUnicode(this.rendered);
  },
);

When(
  "スキーム付き URL と www URL の ket 追加マクロ風文字列を変換する",
  function (this: StepWorld) {
    transform(
      this,
      [
        String.raw`https://example.com/$\ket{s}$`,
        String.raw`www.example.com/$\ket{t}$`,
      ].join("\n"),
    );
  },
);

When(
  "スラッシュなしスキーム URL の ket 追加マクロ風文字列を変換する",
  function (this: StepWorld) {
    transform(
      this,
      [
        String.raw`mailto:user+$\ket{s}$@example.com`,
        String.raw`tel:+81-$\ket{t}$`,
        String.raw`urn:example:$\ket{u}$`,
        String.raw`data:text/plain,$\ket{v}$`,
      ].join("\n"),
    );
  },
);

When(
  "braket 追加マクロを含む丸括弧区切りのインライン数式を描く",
  function (this: StepWorld) {
    transform(this, String.raw`\(\braket{s|\psi}\)`);
    this.unicode = renderUnicode(this.rendered);
  },
);

When(
  "braket 利用者マクロを含むドル区切りのインライン数式を描く",
  function (this: StepWorld) {
    transform(this, String.raw`$\braket{s|\psi}$`);
    this.unicode = renderUnicode(this.rendered);
  },
);

When(
  "Object prototype 名と ket 追加マクロを含む本文を変換する",
  function (this: StepWorld) {
    transform(this, String.raw`$\constructor{x}$ and $\ket{s}$`);
  },
);

When(
  "金額とシェル変数の後に ket 追加マクロがある本文を描く",
  function (this: StepWorld) {
    transform(
      this,
      [
        String.raw`価格は $5、状態は $\ket{s}$。`,
        String.raw`$HOME の後は $\ket{t}$。`,
      ].join("\n"),
    );
    this.unicode = renderUnicode(this.rendered);
  },
);

When(
  "相対 Markdown URL に ket 追加マクロ風文字列がある本文を変換する",
  function (this: StepWorld) {
    transform(this, String.raw`[doc](/guide/$\ket{s}$)`);
  },
);

When(
  "スキームなし URL に ket 追加マクロ風文字列がある本文を変換する",
  function (this: StepWorld) {
    transform(
      this,
      [
        String.raw`//example.com/$\ket{s}$`,
        String.raw`example.com/$\ket{t}$`,
      ].join("\n"),
    );
  },
);

When(
  "ket 追加マクロの直後に英字があるインライン数式を描く",
  function (this: StepWorld) {
    transform(this, String.raw`$\ket{x}y$`);
    this.unicode = renderUnicode(this.rendered);
  },
);

When("グループを持たない二乗追加マクロを変換する", function (this: StepWorld) {
  transform(this, String.raw`$\sq{a+b}$ / $\groupedSq{a+b}$`);
});

When(
  "0 引数追加マクロの後に空白と英字があるインライン数式を描く",
  function (this: StepWorld) {
    transform(this, String.raw`$\alpha x$`);
    this.unicode = renderUnicode(this.rendered);
  },
);

When(
  "バックスラッシュ制御記号の後に ket と同じ英字がある本文を変換する",
  function (this: StepWorld) {
    transform(this, String.raw`$\\ket{x}$`);
  },
);

When(
  "参照リンク定義に ket 追加マクロ風文字列がある本文を変換する",
  function (this: StepWorld) {
    transform(this, String.raw`[ket]: /guide/$\ket{s}$`);
  },
);

When(
  "丸括弧を含む相対 Markdown URL に ket 追加マクロ風文字列がある本文を変換する",
  function (this: StepWorld) {
    transform(this, String.raw`[doc](/guide/(v1)/$\ket{s}$)`);
  },
);

When("ket 追加マクロを含む Markdown 表を描く", function (this: StepWorld) {
  transform(
    this,
    ["| 状態 |", "| --- |", String.raw`| $\ket{s}$ |`].join("\n"),
  );
  const passthroughTheme = new Proxy(
    {} as ConstructorParameters<typeof Markdown>[3],
    { get: () => (value: string) => value },
  );
  this.tableLines = new Markdown(this.rendered, 0, 0, passthroughTheme).render(
    80,
  );
});

When(
  "入れ子の ket 追加マクロを含むインライン数式を描く",
  function (this: StepWorld) {
    transform(this, String.raw`$\ket{\ket{x}}$`);
    this.unicode = renderUnicode(this.rendered);
  },
);

When(
  "自分自身を呼ぶ追加マクロを含むインライン数式を変換する",
  function (this: StepWorld) {
    transform(this, String.raw`$\loop$`);
  },
);

When(
  "空文字列の利用者マクロを含むインライン数式を変換する",
  function (this: StepWorld) {
    transform(this, String.raw`$\empty$`);
  },
);

When(
  "丸括弧区切りの ket 追加マクロ風文字列を含む bare URL を変換する",
  function (this: StepWorld) {
    transform(this, String.raw`https://example.com/\(\ket{s}\)`);
  },
);

When("未登録の ket を含むインライン数式を変換する", function (this: StepWorld) {
  transform(this, String.raw`$\ket{s}$`);
});

When(
  "展開後も描けない命令を含むインライン数式を変換する",
  function (this: StepWorld) {
    transform(this, String.raw`$\ket{\notacommand{x}}$`);
  },
);

When(
  "コードと金額と URL とシェル変数に追加マクロがある本文を変換する",
  function (this: StepWorld) {
    transform(
      this,
      [
        "```text",
        String.raw`$\ket{s}$`,
        "```",
        "inline: `$\\ket{s}$`",
        "$5 and $10",
        String.raw`https://example.com/$\ket{s}$`,
        "$HOME and $" + "{PATH}",
        String.raw`escaped: \$\ket{s}$`,
      ].join("\n"),
    );
  },
);

Then("ket 追加マクロが Unicode で描かれる", function (this: StepWorld) {
  assert.equal(this.unicode, "|s⟩");
});

Then("コロン直後の表示数式が画像になる", function (this: StepWorld) {
  assert.equal(imageCount(this.rendered), 1);
});

Then(
  "コロン直後の ket 追加マクロが Unicode で描かれる",
  function (this: StepWorld) {
    assert.equal(this.unicode, "State:|s⟩");
  },
);

Then(
  "URL 内のシェル変数は残り後続の ket 追加マクロが Unicode で描かれる",
  function (this: StepWorld) {
    assert.equal(this.unicode, "https://example.com/$HOME の後は |s⟩");
  },
);

Then("スキーム付き URL と www URL は変更されない", function (this: StepWorld) {
  assert.equal(this.rendered, this.source);
});

Then("スラッシュなしスキーム URL は変更されない", function (this: StepWorld) {
  assert.equal(this.rendered, this.source);
});

Then("braket 追加マクロが Unicode で描かれる", function (this: StepWorld) {
  assert.equal(this.unicode, "⟨s|ψ⟩");
});

Then("braket 利用者マクロが Unicode で描かれる", function (this: StepWorld) {
  assert.equal(this.unicode, "⟨s|ψ⟩");
});

Then(
  "Object prototype 名は残り ket 追加マクロだけが展開される",
  function (this: StepWorld) {
    assert.equal(
      this.rendered,
      String.raw`$\constructor{x}$ and $\left\vert{}s\right\rangle$`,
    );
  },
);

Then(
  "金額とシェル変数は残り後続の ket 追加マクロが Unicode で描かれる",
  function (this: StepWorld) {
    assert.equal(this.unicode, "価格は $5、状態は |s⟩。\n$HOME の後は |t⟩。");
  },
);

Then("相対 Markdown URL は変更されない", function (this: StepWorld) {
  assert.equal(this.rendered, this.source);
});

Then("スキームなし URL は変更されない", function (this: StepWorld) {
  assert.equal(this.rendered, this.source);
});

Then(
  "ket 追加マクロと後続英字が Unicode で描かれる",
  function (this: StepWorld) {
    assert.equal(this.unicode, "|x⟩y");
  },
);

Then(
  "二乗追加マクロの引数は自動でグループ化されない",
  function (this: StepWorld) {
    assert.equal(this.rendered, "$a+b^2$ / $" + "{a+b}^2$");
  },
);

Then(
  "0 引数追加マクロと後続英字が Unicode で描かれる",
  function (this: StepWorld) {
    assert.equal(this.unicode, "αx");
  },
);

Then("バックスラッシュ制御記号の後は変更されない", function (this: StepWorld) {
  assert.equal(this.rendered, this.source);
});

Then("参照リンク定義は変更されない", function (this: StepWorld) {
  assert.equal(this.rendered, this.source);
});

Then(
  "丸括弧を含む相対 Markdown URL は変更されない",
  function (this: StepWorld) {
    assert.equal(this.rendered, this.source);
  },
);

Then(
  "表の列を保ったまま ket 追加マクロが Unicode で描かれる",
  function (this: StepWorld) {
    const row = this.tableLines.find((line) => line.includes("|s⟩"));
    assert.equal((row?.match(/│/gu) ?? []).length, 2);
  },
);

Then(
  "入れ子の ket 追加マクロが Unicode で描かれる",
  function (this: StepWorld) {
    assert.equal(this.unicode, "||x⟩⟩");
  },
);

Then("再帰する追加マクロは原文のまま残る", function (this: StepWorld) {
  assert.equal(this.rendered, this.source);
});

Then("空のインライン数式にせず原文のまま残る", function (this: StepWorld) {
  assert.equal(this.rendered, this.source);
});

Then("丸括弧区切りを含む bare URL は変更されない", function (this: StepWorld) {
  assert.equal(this.rendered, this.source);
});

Then("未登録の ket は原文のまま残る", function (this: StepWorld) {
  assert.equal(this.rendered, this.source);
});

Then("描けないインライン数式は原文のまま残る", function (this: StepWorld) {
  assert.equal(this.rendered, this.source);
});

Then("追加マクロがある保護対象は変更されない", function (this: StepWorld) {
  assert.equal(this.rendered, this.source);
});

When("4 種類の数式区切りを含む本文を変換する", function (this: StepWorld) {
  transform(this, "$x$ と $$y$$ と \\(z\\) と \\[w\\]");
});

When(
  "コードフェンスと文中コードに数式がある本文を変換する",
  function (this: StepWorld) {
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
  },
);

When(
  "長い区切りと字下げと末尾空白を持つコードフェンスを変換する",
  function (this: StepWorld) {
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
  },
);

When(
  "正規表現メタ文字を含む行があるコードフェンスを変換する",
  function (this: StepWorld) {
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
  },
);

When("thinking の本文を変換する", function (this: StepWorld) {
  transform(this, "考える: $$x$$", { messageType: "assistant-thinking" });
});

When(
  "金額と URL とシェル変数とエスケープ済みドル記号を含む本文を変換する",
  function (this: StepWorld) {
    transform(
      this,
      [
        "It costs $5 or $10. https://example.com/$5 uses $HOME and \\$5.",
        "Keep https://example.com/$$x$$/page and run echo $$; kill $$ safely.",
      ].join("\n"),
    );
  },
);

When("曖昧なドル記号を含む本文を変換する", function (this: StepWorld) {
  transform(this, "The values are $first and $second, not a formula.");
});

When("箇条書き内の表示数式を変換する", function (this: StepWorld) {
  transform(this, "- 外側\n  - 式: $$\n    x^2\n    $$");
});

When("引用内の表示数式を変換する", function (this: StepWorld) {
  transform(this, "> 式: \\[\n> x^2\n> \\]");
});

When(
  "閉じた数式まで届いたストリーミング本文を変換する",
  function (this: StepWorld) {
    transform(this, "途中\n$$x$$\n続き", { isStreaming: true });
  },
);

When(
  "未完成な数式まで届いたストリーミング本文を変換する",
  function (this: StepWorld) {
    transform(this, "途中\n$$\\frac{1}{2}", { isStreaming: true });
  },
);

When(
  "数式でない $$ と後続の表示数式を含む本文を変換する",
  function (this: StepWorld) {
    transform(
      this,
      [
        "閉じていない $$ は数式になりません。",
        "",
        "## 行列指数",
        "",
        "$$e^{-i H t} = \\sum_{n=0}^{\\infty} \\frac{(-iHt)^n}{n!}$$",
        "",
        "以上です。",
      ].join("\n"),
    );
  },
);

When("$$ を含む金額を変換する", function (this: StepWorld) {
  transform(this, "価格は $$100 です。");
});

When(
  "再走査される金額と後続の表示数式を含む本文を変換する",
  function (this: StepWorld) {
    const source =
      "前置き $$ は数式ではありません。\n価格は $$100\n\n$$x = 1$$";
    transform(this, source);
    this.actualFormulaImages = imageIdentities(this.rendered);
  },
);

When(
  "コロン付きラベル「{word}」の再走査される金額と後続の表示数式を含む本文を変換する",
  function (this: StepWorld, label: string) {
    this.labeledAmount = `${label} $$100`;
    transform(
      this,
      `前置き $$ は数式ではありません。\n${this.labeledAmount}\n\n$$x = 1$$`,
    );
    this.actualLabeledAmountFormulaImages = imageIdentities(this.rendered);
  },
);

When(
  "再走査される金額と表示数式と末尾のシェルの $$ を変換する",
  function (this: StepWorld) {
    transform(
      this,
      "前置き $$ は数式ではありません。\n価格は $$100\n\n$$x = 1$$\nrun echo $$",
    );
    this.actualFormulaBeforeShellImages = imageIdentities(this.rendered);
  },
);

When(
  "再走査される金額と独立した区切り行の表示数式を含む本文を変換する",
  function (this: StepWorld) {
    transform(
      this,
      "前置き $$ は数式ではありません。\n価格は $$100\n\n$$\nx = 1\n$$",
    );
    this.actualIndependentFormulaImages = imageIdentities(this.rendered);
  },
);

When(
  "数式でない $$ と後続の数値だけの表示数式を含む本文を変換する",
  function (this: StepWorld) {
    transform(this, "前置き $$ は数式ではありません。\n\n$$100$$");
    this.actualNumericFormulaImages = imageIdentities(this.rendered);
  },
);

When(
  "数式でない $$ と閉じ区切りを後続行に置いた数値表示数式を変換する",
  function (this: StepWorld) {
    transform(this, "前置き $$ は数式ではありません。\n\n$$100\n$$");
    this.actualMultilineNumericFormulaImages = imageIdentities(this.rendered);
  },
);

When(
  "数式でない $$ と行内ラベル付きの数値表示数式を変換する",
  function (this: StepWorld) {
    transform(this, "前置き $$ は数式ではありません。\n式: $$100\n$$");
    this.actualLabeledNumericFormulaImages = imageIdentities(this.rendered);
  },
);

When(
  "数式でない $$ と数値表示数式と単一英字と後続の表示数式を変換する",
  function (this: StepWorld) {
    this.expectedSeparatedFormulaImages = [
      ...this.referenceNumericImages,
      ...this.referenceFollowingImages,
    ];
    transform(
      this,
      "前置き $$ は数式ではありません。\n\n$$100\n$$\n\nx\n\n$$y = 1$$",
    );
    this.actualSeparatedFormulaImages = imageIdentities(this.rendered);
  },
);

When(
  "数式でない $$ と数値表示数式と単一英字と閉じていない $$ を変換する",
  function (this: StepWorld) {
    transform(this, "前置き $$ は数式ではありません。\n\n$$100\n$$\n\nx\n\n$$");
    this.actualNumericBeforeUnclosedImages = imageIdentities(this.rendered);
  },
);

When("通常の表示数式を変換する", function (this: StepWorld) {
  transform(this, "$$a = b$$");
});

When("$$ を含む URL を変換する", function (this: StepWorld) {
  transform(this, "https://example.com/a$$b$$c");
});

When(
  "シェルの $$ と後続の表示数式を含む本文を変換する",
  function (this: StepWorld) {
    transform(this, "run echo $$; kill $$ after 2 seconds.\n\n$$x = 1$$");
  },
);

When(
  "改行を含むシェルの $$ と後続の表示数式を含む本文を変換する",
  function (this: StepWorld) {
    transform(this, "run echo $$;\nkill $$ after 2 seconds.\n\n$$x = 1$$");
  },
);

When(
  "行頭の $$ を含む通常本文と後続の表示数式を変換する",
  function (this: StepWorld) {
    transform(
      this,
      "前置き $$ は数式ではありません。\n$$100 です。\n\n$$x = 1$$",
    );
  },
);

When(
  "数式でない $$ とラベル付き表示数式を含む本文を変換する",
  function (this: StepWorld) {
    transform(
      this,
      "閉じていない $$ は数式になりません。\n\n式: $$\nx = 1\n$$",
    );
  },
);

When("数式でない $$ を一万個含む本文を変換する", function (this: StepWorld) {
  const started = performance.now();
  transform(this, "$$通常本文\n".repeat(10_000));
  this.scanDuration = performance.now() - started;
});

When(
  "不正な表示数式と正しい表示数式を含む本文を変換する",
  function (this: StepWorld) {
    transform(this, "$$\\notacommand{$$\n次の本文\n$$x$$");
  },
);

Then("ドル区切りのインライン数式は変換結果に残る", function (this: StepWorld) {
  assert.deepEqual(this.rendered.includes("$x$"), true);
});

Then(
  "丸括弧区切りのインライン数式は変換結果に残る",
  function (this: StepWorld) {
    assert.deepEqual(this.rendered.includes("\\(z\\)"), true);
  },
);

Then("4種類の区切りのうち表示数式2件が画像になる", function (this: StepWorld) {
  assert.deepEqual(imageCount(this.rendered), 2);
});

Then("コード内の本文は変更されない", function (this: StepWorld) {
  assert.equal(this.rendered, this.source);
});

Then(
  "長いバッククォートのフェンス内の表示数式は残る",
  function (this: StepWorld) {
    assert.deepEqual(this.rendered.includes("$$backtick$$"), true);
  },
);

Then("長いチルダのフェンス内の表示数式は残る", function (this: StepWorld) {
  assert.deepEqual(this.rendered.includes("$$tilde$$"), true);
});

Then("長いフェンスの後の表示数式1件が画像になる", function (this: StepWorld) {
  assert.deepEqual(imageCount(this.rendered), 1);
});

Then(
  "メタ文字を含むバッククォート行はフェンスを閉じない",
  function (this: StepWorld) {
    assert.deepEqual(
      this.rendered.includes("$$afterBacktickMetacharacters$$"),
      true,
    );
  },
);

Then("メタ文字を含むチルダ行はフェンスを閉じない", function (this: StepWorld) {
  assert.deepEqual(
    this.rendered.includes("$$afterTildeMetacharacters$$"),
    true,
  );
});

Then(
  "メタ文字を含むフェンスの後の表示数式1件が画像になる",
  function (this: StepWorld) {
    assert.deepEqual(imageCount(this.rendered), 1);
  },
);

Then("thinking の本文は変更されない", function (this: StepWorld) {
  assert.equal(this.rendered, this.source);
});

Then("通常のドル記号を含む本文は変更されない", function (this: StepWorld) {
  assert.equal(this.rendered, this.source);
});

Then("曖昧なドル記号を含む本文は変更されない", function (this: StepWorld) {
  assert.equal(this.rendered, this.source);
});

Then("画像は箇条書きの字下げに残る", function (this: StepWorld) {
  assert.equal(placeholderLines(this.rendered)[0]?.startsWith("    "), true);
});

Then("画像は引用の階層に残る", function (this: StepWorld) {
  assert.equal(placeholderLines(this.rendered)[0]?.startsWith("> "), true);
});

Then("閉じた表示数式は画像経路で描かれる", function (this: StepWorld) {
  assert.equal(imageCount(this.rendered), 1);
});

Then("未完成な数式は原文のまま残る", function (this: StepWorld) {
  assert.equal(this.rendered, this.source);
});

Then("後続の表示数式だけが画像になる", function (this: StepWorld) {
  assert.equal(imageCount(this.rendered), 1);
});

Then("見送った本文は入力どおり一度だけ残る", function (this: StepWorld) {
  const skipped = "閉じていない $$ は数式になりません。\n\n## 行列指数\n\n";
  assert.equal(this.rendered.split(skipped).length - 1, 1);
});

Then("金額は入力どおり残る", function (this: StepWorld) {
  assert.equal(this.rendered, this.source);
});

Then("画像経路で描かれる式は x = 1 だけになる", function (this: StepWorld) {
  assert.deepEqual(this.actualFormulaImages, this.expectedFormulaImages);
});

Then("コロン付き金額の後はx = 1だけが画像になる", function (this: StepWorld) {
  assert.deepEqual(
    this.actualLabeledAmountFormulaImages,
    this.expectedLabeledAmountFormulaImages,
  );
});

Then("コロン付きラベルの金額は一度だけ残る", function (this: StepWorld) {
  assert.deepEqual(this.rendered.split(this.labeledAmount).length - 1, 1);
});

Then(
  "金額とシェルを含む本文ではx = 1だけが画像になる",
  function (this: StepWorld) {
    assert.deepEqual(
      this.actualFormulaBeforeShellImages,
      this.expectedFormulaBeforeShellImages,
    );
  },
);

Then(
  "表示数式とシェルを含む本文の金額は一度だけ残る",
  function (this: StepWorld) {
    assert.deepEqual(this.rendered.split("価格は $$100").length - 1, 1);
  },
);

Then(
  "表示数式と金額を含む本文のシェルの$$は一度だけ残る",
  function (this: StepWorld) {
    assert.deepEqual(this.rendered.split("run echo $$").length - 1, 1);
  },
);

Then("独立した区切り行ではx = 1だけが画像になる", function (this: StepWorld) {
  assert.deepEqual(
    this.actualIndependentFormulaImages,
    this.expectedIndependentFormulaImages,
  );
});

Then("独立した表示数式の前の金額は一度だけ残る", function (this: StepWorld) {
  assert.deepEqual(this.rendered.split("価格は $$100").length - 1, 1);
});

Then("画像経路で描かれる式は 100 だけになる", function (this: StepWorld) {
  assert.deepEqual(
    this.actualNumericFormulaImages,
    this.expectedNumericFormulaImages,
  );
});

Then(
  "画像経路で描かれる複数行区切りの式は 100 だけになる",
  function (this: StepWorld) {
    assert.deepEqual(
      this.actualMultilineNumericFormulaImages,
      this.expectedMultilineNumericFormulaImages,
    );
  },
);

Then(
  "画像経路で描かれるラベル付きの式は 100 だけになる",
  function (this: StepWorld) {
    assert.deepEqual(
      this.actualLabeledNumericFormulaImages,
      this.expectedLabeledNumericFormulaImages,
    );
  },
);

Then("数値数式と後続のy = 1だけが画像になる", function (this: StepWorld) {
  assert.deepEqual(
    this.actualSeparatedFormulaImages,
    this.expectedSeparatedFormulaImages,
  );
});

Then("二つの表示数式の間の単一英字は一度だけ残る", function (this: StepWorld) {
  assert.deepEqual(this.rendered.split("\nx\n").length - 1, 1);
});

Then("未完の区切りより前にある100だけが画像になる", function (this: StepWorld) {
  assert.deepEqual(
    this.actualNumericBeforeUnclosedImages,
    this.expectedNumericBeforeUnclosedImages,
  );
});

Then(
  "未完の区切りと数値数式の間の単一英字は一度だけ残る",
  function (this: StepWorld) {
    assert.deepEqual(this.rendered.split("\nx\n").length - 1, 1);
  },
);

Then("数値数式の後の未完の区切りは残る", function (this: StepWorld) {
  assert.deepEqual(this.rendered.endsWith("$$"), true);
});

Then("一つの表示数式が画像になる", function (this: StepWorld) {
  assert.equal(imageCount(this.rendered), 1);
});

Then("URL は入力どおり残る", function (this: StepWorld) {
  assert.equal(this.rendered, this.source);
});

Then("シェルの通常本文は入力どおり残る", function (this: StepWorld) {
  const shellText = "run echo $$; kill $$ after 2 seconds.";
  assert.equal(this.rendered.split(shellText).length - 1, 1);
});

Then("シェルに続く表示数式1件が画像になる", function (this: StepWorld) {
  assert.deepEqual(imageCount(this.rendered), 1);
});

Then(
  "シェルに続くx = 1のLaTeXは変換結果に残らない",
  function (this: StepWorld) {
    assert.deepEqual(this.rendered.includes("x = 1"), false);
  },
);

Then("改行を含むシェルの通常本文は入力どおり残る", function (this: StepWorld) {
  const shellText = "run echo $$;\nkill $$ after 2 seconds.";
  assert.equal(this.rendered.split(shellText).length - 1, 1);
});

Then("行頭の $$ を含む通常本文は入力どおり残る", function (this: StepWorld) {
  const text = "前置き $$ は数式ではありません。\n$$100 です。";
  assert.equal(this.rendered.split(text).length - 1, 1);
});

Then("非数式の$$に続く表示数式1件が画像になる", function (this: StepWorld) {
  assert.deepEqual(imageCount(this.rendered), 1);
});

Then(
  "非数式の$$に続くx = 1のLaTeXは変換結果に残らない",
  function (this: StepWorld) {
    assert.deepEqual(this.rendered.includes("x = 1"), false);
  },
);

Then(
  "ラベル付き表示数式の前の本文は入力どおり一度だけ残る",
  function (this: StepWorld) {
    const text = "閉じていない $$ は数式になりません。\n\n式: ";
    assert.equal(this.rendered.split(text).length - 1, 1);
  },
);

Then("走査は一秒以内に終わる", function (this: StepWorld) {
  assert.ok(this.scanDuration < 1_000, `${this.scanDuration}ms`);
});

Then("不正な表示数式は変換結果に残る", function (this: StepWorld) {
  assert.deepEqual(this.rendered.includes("$$\\notacommand{$$"), true);
});

Then("不正な表示数式に続く本文は変換結果に残る", function (this: StepWorld) {
  assert.deepEqual(this.rendered.includes("次の本文"), true);
});

Then(
  "不正な表示数式の後の正しい数式1件が画像になる",
  function (this: StepWorld) {
    assert.deepEqual(imageCount(this.rendered), 1);
  },
);

Given("pi-formula の画像処理設定を読む", function (this: StepWorld) {
  this.safetyLimits = require("../../dist/typesetter.js").FORMULA_SAFETY_LIMITS;
});

When("固定上限を確認する", function (this: StepWorld) {
  this.limitValues = Object.values(this.safetyLimits ?? {});
});

Then(
  "画像処理の安全上限には定義された7項目が含まれる",
  function (this: StepWorld) {
    assert.deepEqual(Object.keys(this.safetyLimits ?? {}).sort(), [
      "cacheBytes",
      "cacheEntries",
      "imageColumns",
      "imageRows",
      "latexCharacters",
      "pngBytes",
      "pngPixels",
    ]);
  },
);

Then(
  "画像処理のすべての安全上限は有限の正整数である",
  function (this: StepWorld) {
    assert.deepEqual(
      this.limitValues.every(
        (value) => Number.isSafeInteger(value) && value > 0,
      ),
      true,
    );
  },
);

When(
  "上限を超えた表示数式と正しい表示数式を変換する",
  function (this: StepWorld) {
    const limits: typeof import("../../dist/typesetter.js").FORMULA_SAFETY_LIMITS =
      require("../../dist/typesetter.js").FORMULA_SAFETY_LIMITS;
    this.oversizedLatex = `x${" ".repeat(limits.latexCharacters)}`;
    this.tooTallLatex = `\\begin{aligned}${Array.from(
      { length: limits.imageRows + 1 },
      (_, index) => `x_{${index}}`,
    ).join("\\\\")}\\end{aligned}`;
    transform(
      this,
      `$$${this.oversizedLatex}$$\n$$${this.tooTallLatex}$$\n$$x+7$$`,
    );
  },
);

Then("入力文字数上限を超えた数式は変換結果に残る", function (this: StepWorld) {
  assert.deepEqual(this.rendered.includes(this.oversizedLatex), true);
});

Then("画像行数上限を超えた数式は変換結果に残る", function (this: StepWorld) {
  assert.deepEqual(this.rendered.includes(this.tooTallLatex), true);
});

Then(
  "上限を超えた数式の後の正しい数式1件が画像になる",
  function (this: StepWorld) {
    assert.deepEqual(imageCount(this.rendered), 1);
  },
);

When(
  "基準の半分より小さくなる表示数式と正しい表示数式を変換する",
  function (this: StepWorld) {
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
  },
);

Then("読めない縮尺になる数式は変換結果に残る", function (this: StepWorld) {
  assert.deepEqual(this.rendered.includes(this.smallLatex), true);
});

Then(
  "読めない縮尺の数式の後の正しい数式1件が画像になる",
  function (this: StepWorld) {
    assert.deepEqual(imageCount(this.rendered), 1);
  },
);

When(
  "テーマと幅の比較用数式を {int} 列で描く",
  function (this: StepWorld, width: number) {
    const rendered = this.pi.transformer()("$$x_{theme-width}$$", {
      messageType: "assistant",
      isStreaming: false,
      availableWidth: width,
    });
    this.imageIdentities ??= [];
    this.imageIdentities.push(/\bi=(\d+)/u.exec(rendered)?.[1]);
  },
);

Then(
  "テーマ色と表示幅の各変更が別の一時保存項目になる",
  function (this: StepWorld) {
    assert.equal(new Set(this.imageIdentities).size, 3);
  },
);

Given(
  "正確な RGB を返さない画像経路の Pi がある",
  async function (this: StepWorld) {
    this.pi = fakePi();
    registerFormula(this.pi.api);
    await startWithKitty(this.pi, {
      foregroundAnsi: "\x1b[38;5;250m",
      foregroundResponse: "rgb:invalid",
    });
  },
);

When("表示数式を変換する", function (this: StepWorld) {
  transform(this, "$$x_{rgb}$$");
});

Then("RGB を得られない数式は原文のまま残る", function (this: StepWorld) {
  assert.equal(this.rendered, this.source);
});

Given("件数上限が3件の画像一時保存がある", function (this: StepWorld) {
  const {
    RenderCache,
  }: typeof import("../../dist/render-cache.js") = require("../../dist/render-cache.js");
  this.renderCache = new RenderCache(3, 10_000);
  this.cacheCreates = new Map();

  this.cacheImageBytes = 20;
});

When(
  "一時保存から画像 {word} を取得する",
  function (this: StepWorld, key: string) {
    this.renderCache.getOrCreate(key, () => {
      this.cacheCreates.set(key, (this.cacheCreates.get(key) ?? 0) + 1);
      return cacheImage(this.cacheImageBytes);
    });
    this.cacheStats = this.renderCache.stats();
  },
);

Then("件数上限を超えた最も古い項目は再作成される", function (this: StepWorld) {
  assert.deepEqual(this.cacheCreates.get("a"), 2);
});

Then("最近使った2件目の一時保存は再作成されない", function (this: StepWorld) {
  assert.deepEqual(this.cacheCreates.get("b"), 1);
});

Then("画像の一時保存は3件以内に収まる", function (this: StepWorld) {
  assert.deepEqual(this.cacheStats.entries <= 3, true);
});

Given("バイト上限が300バイトの画像一時保存がある", function (this: StepWorld) {
  const {
    RenderCache,
  }: typeof import("../../dist/render-cache.js") = require("../../dist/render-cache.js");
  this.renderCache = new RenderCache(10, 300);
  this.cacheCreates = new Map();

  this.cacheImageBytes = 80;
});

Then(
  "バイト上限を超えた最も古い項目は再作成される",
  function (this: StepWorld) {
    assert.deepEqual(this.cacheCreates.get("a"), 2);
  },
);

Then(
  "バイト上限を超えた一時保存には最後の1件が残る",
  function (this: StepWorld) {
    assert.deepEqual(this.cacheStats.entries, 1);
  },
);

Then("画像の一時保存は300バイト以内に収まる", function (this: StepWorld) {
  assert.deepEqual(this.cacheStats.bytes <= 300, true);
});

Given(
  "画像結果を作る回数を数えられる一時保存がある",
  function (this: StepWorld) {
    const {
      RenderCache,
    }: typeof import("../../dist/render-cache.js") = require("../../dist/render-cache.js");
    this.renderCache = new RenderCache(3, 300);
    this.failedCreates = 0;
  },
);

When("一時保存から同じ失敗項目を取得する", function (this: StepWorld) {
  this.renderCache.getOrCreate("failure", () => {
    this.failedCreates += 1;
    throw new Error("invalid LaTeX");
  });
});

Then("同じ失敗項目の画像処理は一回だけになる", function (this: StepWorld) {
  assert.equal(this.failedCreates, 1);
});

When(
  "再現本文の {int} 番目までのフレームを描く",
  function (this: StepWorld, count: number) {
    if (count < 1 || count > 4)
      throw new Error(`unknown reproduction frame: ${count}`);
    this.streamingFormulaFrames ??= [];
    this.streamingFormulaFrames.push(renderStreamingFrame(this.pi, count));
  },
);

Then(
  "変換結果の画像転送数は順に1・2・3・4件である",
  function (this: StepWorld) {
    assert.deepEqual(
      inspectStreamingRegression(this.streamingFormulaFrames).map(
        (frame) => frame.transformedTransferCount,
      ),
      [1, 2, 3, 4],
    );
  },
);

When(
  "先行するqniツールの呼び出しと結果をTUIに描く",
  function (this: StepWorld) {
    this.issue26Tui = tuiUpdates(["qni tool call", "qni tool result"]);
    this.issue26Updates.tuiWrites.initial = this.issue26Tui.render("");
  },
);

Then("先行するツール描画が残る", function (this: TuiFramesWorld) {
  assert.equal(
    this.issue26Updates.tuiWrites.initial.includes("qni tool result"),
    true,
  );
});

Then("画像経路で描く表示数式が1件ずつ増える", function (this: StepWorld) {
  assert.deepEqual(this.issue26Updates.streaming.map(imageCount), [1, 2, 3]);
});

Then(
  "各差分描画は新しい表示数式を1件ずつ転送する",
  function (this: TuiFramesWorld) {
    assert.deepEqual(
      [
        ...this.issue26Updates.tuiWrites.streaming.map(imageCount),
        imageCount(this.issue26Updates.tuiWrites.finalized),
      ],
      [1, 1, 1, 0],
    );
  },
);

Then(
  "逐次更新の画像IDは各転送の画像IDと一致する",
  function (this: FormulaFramesWorld) {
    const frames = [
      ...this.issue26Updates.streaming,
      this.issue26Updates.finalized,
    ];
    assert.deepEqual(
      frames.map((frame) =>
        inspectPlacementBlocks(frame).map(
          (block) => block.id === block.transferId,
        ),
      ),
      [[true], [true, true], [true, true, true], [true, true, true]],
    );
  },
);

When(
  "同じ複数行表示数式を一回の確定応答内に二回配置する",
  function (this: StepWorld) {
    const formula = String.raw`$$\begin{pmatrix}1&0\\0&1\end{pmatrix}$$`;
    transform(this, [formula, "端末上の画像を破棄", formula].join("\n\n"));
    this.cachedPlacementBlocks = inspectPlacementBlocks(this.rendered);
  },
);

Then("同じ応答内の画像配置は2件である", function (this: StepWorld) {
  assert.equal(this.cachedPlacementBlocks.length, 2);
});

When("外部作用を監視しながら表示数式を変換する", function (this: StepWorld) {
  const monitor = monitorExternalEffects();
  try {
    transform(this, "$$x_{memory-only}+11$$");
  } finally {
    monitor.restore();
  }
  this.externalCalls = monitor.calls;
  this.browserModules = Object.keys(require.cache).filter((path) =>
    /playwright|puppeteer/iu.test(path),
  );
});

Then(
  "画像の変換中にファイル保存も外部サービスも子プロセスも呼ばない",
  function (this: StepWorld) {
    assert.deepEqual(this.externalCalls, []);
  },
);

Then("画像の変換でブラウザ用moduleを読み込まない", function (this: StepWorld) {
  assert.deepEqual(this.browserModules, []);
});

Then(
  "外部作用を禁止しても表示数式1件を画像へ変換できる",
  function (this: StepWorld) {
    assert.deepEqual(imageCount(this.rendered), 1);
  },
);

Given(
  "新しいNode.jsプロセスで拡張を読み込んで登録したPiがある",
  async function (this: StepWorld) {
    this.isolatedRenderer = isolatedRenderer({
      blockKeyCreation: this.blockKeyCreation ?? false,
    });
    const loaded = await this.isolatedRenderer.request("load");
    this.safetyLimits = loaded.limits;
    this.lazyPreparation = { before: loaded.loaded };
    await this.isolatedRenderer.request("register");
  },
);

When("入力上限を超えた表示数式を変換する", async function (this: StepWorld) {
  const source = `$$${"x".repeat(this.safetyLimits.latexCharacters + 1)}$$`;
  const result = await this.isolatedRenderer.request("render", {
    markdown: source,
  });
  this.oversizedPreparation = {
    keyCreations: result.keyCreations,
    prepared: result.loaded,
    unchanged: result.markdown === source,
  };
});

Then(
  "入力文字数上限を超えた数式の一時保存キーは作られない",
  function (this: StepWorld) {
    assert.deepEqual(this.oversizedPreparation.keyCreations, 0);
  },
);

Then(
  "入力文字数上限を超えた数式は画像処理部品を準備しない",
  function (this: StepWorld) {
    assert.deepEqual(this.oversizedPreparation.prepared, false);
  },
);

Then("入力文字数上限を超えた数式は原文のまま残る", function (this: StepWorld) {
  assert.deepEqual(this.oversizedPreparation.unchanged, true);
});

When("表示数式を初めて変換する", async function (this: StepWorld) {
  const result = await this.isolatedRenderer.request("render", {
    markdown: "$$x_{lazy}$$",
  });
  this.lazyPreparation.afterFormula = result.loaded;
});

Then(
  "数式の描画前にはMathJaxもResvgも読み込まれていない",
  function (this: StepWorld) {
    assert.deepEqual(this.lazyPreparation.before, false);
  },
);

Then(
  "セッション開始だけではMathJaxもResvgも読み込まれない",
  function (this: StepWorld) {
    assert.deepEqual(this.lazyPreparation.afterSessionStart, false);
  },
);

Then(
  "最初の表示数式でMathJaxとResvgが読み込まれる",
  function (this: StepWorld) {
    assert.deepEqual(this.lazyPreparation.afterFormula, true);
  },
);

When(
  "異なる未キャッシュ数式5件の変換時間を計測する",
  async function (this: StepWorld) {
    this.durations = { uncachedSamples: [], cachedSamples: [] };
    for (let index = 1; index <= 5; index++) {
      const result = await this.isolatedRenderer.request("render", {
        markdown: `$$x_{cold${index}}$$`,
      });
      this.durations.uncachedSamples.push(result.duration);
    }
  },
);

Then(
  "一時保存済みの中央値は未キャッシュ中央値の5パーセント未満である",
  function (this: StepWorld) {
    const median = (samples: number[]) => {
      const sorted = [...samples].sort((left, right) => left - right);
      return sorted[Math.floor(sorted.length / 2)];
    };
    const uncachedMedian = median(this.durations.uncachedSamples);
    const cachedMedian = median(this.durations.cachedSamples);
    const cachedRatio = cachedMedian / uncachedMedian;
    assert.ok(
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

When("比較用の表示数式1を先に描く", function (this: StepWorld) {
  transform(this, "$$x = 1$$");
  this.expectedFormulaImages = imageIdentities(this.rendered);
});

When("比較用のx = 1を先に描く", function (this: StepWorld) {
  transform(this, "$$x = 1$$");
  this.expectedLabeledAmountFormulaImages = imageIdentities(this.rendered);
});

When("比較用の表示数式2を先に描く", function (this: StepWorld) {
  transform(this, "$$x = 1$$");
  this.expectedFormulaBeforeShellImages = imageIdentities(this.rendered);
});

When("比較用の表示数式3を先に描く", function (this: StepWorld) {
  transform(this, "$$\nx = 1\n$$");
  this.expectedIndependentFormulaImages = imageIdentities(this.rendered);
});

When("比較用の表示数式4を先に描く", function (this: StepWorld) {
  transform(this, "$$100$$");
  this.expectedNumericFormulaImages = imageIdentities(this.rendered);
});

When("比較用の表示数式5を先に描く", function (this: StepWorld) {
  transform(this, "$$100\n$$");
  this.expectedMultilineNumericFormulaImages = imageIdentities(this.rendered);
});

When("比較用の表示数式6を先に描く", function (this: StepWorld) {
  transform(this, "$$100\n$$");
  this.expectedLabeledNumericFormulaImages = imageIdentities(this.rendered);
});

When("比較用の表示数式7を先に描く", function (this: StepWorld) {
  transform(this, "$$100\n$$");
  this.expectedNumericBeforeUnclosedImages = imageIdentities(this.rendered);
});

When("比較用の数値100を先に描く", function (this: StepWorld) {
  transform(this, "$$100\n$$");
  this.referenceNumericImages = imageIdentities(this.rendered);
});

When("比較用のy = 1を次に描く", function (this: StepWorld) {
  transform(this, "$$y = 1$$");
  this.referenceFollowingImages = imageIdentities(this.rendered);
});

When("テーマの文字色をRGBの10・20・30へ変える", function (this: StepWorld) {
  this.started.setTextColor("\x1b[38;2;10;20;30m");
});

When("テーマの文字色をRGBの212・212・212へ戻す", function (this: StepWorld) {
  this.started.setTextColor("\x1b[38;2;212;212;212m");
});

Then("テーマと幅の比較では3個の画像IDが得られる", function (this: StepWorld) {
  assert.deepEqual(this.imageIdentities.map(Boolean), [true, true, true]);
});

Then("端末描画の転送行数は順に1・2・3・4件である", function (this: StepWorld) {
  assert.deepEqual(
    inspectStreamingRegression(this.streamingFormulaFrames).map(
      (frame) => frame.transferLineCount,
    ),
    [1, 2, 3, 4],
  );
});

Then("各転送行には一つの画像転送だけがある", function (this: StepWorld) {
  assert.deepEqual(
    inspectStreamingRegression(this.streamingFormulaFrames).map(
      (frame) => frame.oneTransferPerLine,
    ),
    [true, true, true, true],
  );
});

Then("各フレームの転送チャンクが完結する", function (this: StepWorld) {
  assert.deepEqual(
    inspectStreamingRegression(this.streamingFormulaFrames).map(
      (frame) => frame.completeChunks,
    ),
    [true, true, true, true],
  );
});

Then("各フレームの画像IDと配置IDが一致する", function (this: StepWorld) {
  assert.deepEqual(
    inspectStreamingRegression(this.streamingFormulaFrames).map(
      (frame) => frame.matchingPlacementIds,
    ),
    [true, true, true, true],
  );
});

Then(
  "各フレームのplaceholder行数が画像転送に対応する",
  function (this: StepWorld) {
    assert.deepEqual(
      inspectStreamingRegression(this.streamingFormulaFrames).map(
        (frame) => frame.matchingPlaceholderRows,
      ),
      [true, true, true, true],
    );
  },
);

Then("各フレームの配置は対応する転送に隣接する", function (this: StepWorld) {
  assert.deepEqual(
    inspectStreamingRegression(this.streamingFormulaFrames).map(
      (frame) => frame.adjacentPlacements,
    ),
    [true, true, true, true],
  );
});

Given("Issue 26のコーパスとket追加マクロがある", function (this: StepWorld) {
  require("../../dist/api.js").registerFormula(this.pi.api, {
    ket: [String.raw`\left|#1\right\rangle`, 1],
  });
  this.issue26Source = issue26Source();
  this.issue26Updates = { streaming: [], tuiWrites: { streaming: [] } };
});

When(
  "Issue 26の {int} 番目までの未完了本文を変換する",
  function (this: StepWorld, count: number) {
    const source = this.issue26Source.partials[count - 1];
    if (source === undefined)
      throw new Error(`unknown Issue 26 frame: ${count}`);
    this.issue26Updates.streaming.push(
      this.pi.transformer()(source, {
        messageType: "assistant",
        isStreaming: true,
        availableWidth: 80,
      }),
    );
  },
);

When("Issue 26の確定本文を変換する", function (this: StepWorld) {
  this.issue26Updates.finalized = this.pi.transformer()(
    this.issue26Source.corpus,
    {
      messageType: "assistant",
      isStreaming: false,
      availableWidth: 80,
    },
  );
});

When(
  "Issue 26の {int} 番目の未完了本文をTUIへ更新する",
  function (this: StepWorld, count: number) {
    this.issue26Updates.tuiWrites.streaming.push(
      this.issue26Tui.render(this.issue26Updates.streaming[count - 1]),
    );
  },
);

When("Issue 26の確定本文をTUIへ更新する", function (this: FormulaFramesWorld) {
  this.issue26Updates.tuiWrites.finalized = this.issue26Tui.render(
    this.issue26Updates.finalized,
  );
});

Then(
  "逐次更新のplaceholder行数は各転送の宣言行数と一致する",
  function (this: FormulaFramesWorld) {
    const frames = [
      ...this.issue26Updates.streaming,
      this.issue26Updates.finalized,
    ];
    assert.deepEqual(
      frames.map((frame) =>
        inspectPlacementBlocks(frame).map(
          (block) => block.rows === block.declaredRows,
        ),
      ),
      [[true], [true, true], [true, true, true], [true, true, true]],
    );
  },
);

Then(
  "逐次更新の各配置の転送チャンクは完結する",
  function (this: FormulaFramesWorld) {
    const frames = [
      ...this.issue26Updates.streaming,
      this.issue26Updates.finalized,
    ];
    assert.deepEqual(
      frames.map((frame) =>
        inspectPlacementBlocks(frame).map((block) => block.completeTransfer),
      ),
      [[true], [true, true], [true, true, true], [true, true, true]],
    );
  },
);

Then(
  "逐次更新の各配置は対応する転送に隣接する",
  function (this: FormulaFramesWorld) {
    const frames = [
      ...this.issue26Updates.streaming,
      this.issue26Updates.finalized,
    ];
    assert.deepEqual(
      frames.map((frame) =>
        inspectPlacementBlocks(frame).map((block) => block.adjacentTransfer),
      ),
      [[true], [true, true], [true, true, true], [true, true, true]],
    );
  },
);

Then("同じ応答内の各配置は同じ画像IDを使う", function (this: StepWorld) {
  assert.deepEqual(
    this.cachedPlacementBlocks.map((block) => block.id),
    [this.cachedPlacementBlocks[0]?.id, this.cachedPlacementBlocks[0]?.id],
  );
});

Then("同じ応答内の各配置は複数行である", function (this: StepWorld) {
  assert.deepEqual(
    this.cachedPlacementBlocks.map((block) => block.rows > 1),
    [true, true],
  );
});

Then(
  "一時保存画像の画像IDは各転送の画像IDと一致する",
  function (this: StepWorld) {
    assert.deepEqual(
      this.cachedPlacementBlocks.map((block) => block.id === block.transferId),
      [true, true],
    );
  },
);

Then(
  "一時保存画像のplaceholder行数は各転送の宣言行数と一致する",
  function (this: StepWorld) {
    assert.deepEqual(
      this.cachedPlacementBlocks.map(
        (block) => block.rows === block.declaredRows,
      ),
      [true, true],
    );
  },
);

Then(
  "一時保存画像の各配置の転送チャンクは完結する",
  function (this: StepWorld) {
    assert.deepEqual(
      this.cachedPlacementBlocks.map((block) => block.completeTransfer),
      [true, true],
    );
  },
);

Then(
  "一時保存画像の各配置は対応する転送に隣接する",
  function (this: StepWorld) {
    assert.deepEqual(
      this.cachedPlacementBlocks.map((block) => block.adjacentTransfer),
      [true, true],
    );
  },
);

Given(
  "一時保存キーを作ろうとすると失敗する環境である",
  function (this: StepWorld) {
    this.blockKeyCreation = true;
  },
);

When(
  "分離プロセスで画像経路のセッションを開始する",
  async function (this: StepWorld) {
    const result = await this.isolatedRenderer.request("start");
    this.lazyPreparation.afterSessionStart = result.loaded;
  },
);

When("初回準備用の数式を分離プロセスで描く", async function (this: StepWorld) {
  await this.isolatedRenderer.request("render", { markdown: "$$x_{warmup}$$" });
});

When(
  "一時保存済みの最後の数式を10回計測する",
  async function (this: StepWorld) {
    for (let index = 0; index < 10; index++) {
      const result = await this.isolatedRenderer.request("render", {
        markdown: "$$x_{cold5}$$",
      });
      this.durations.cachedSamples.push(result.duration);
    }
  },
);

Then("未キャッシュ数式の計測は5件である", function (this: StepWorld) {
  assert.equal(this.durations.uncachedSamples.length, 5);
});

Then("一時保存済み数式の計測は10件である", function (this: StepWorld) {
  assert.equal(this.durations.cachedSamples.length, 10);
});

Then("一時保存済みの中央値比は有限である", function (this: StepWorld) {
  const median = (samples: number[]) =>
    [...samples].sort((a, b) => a - b)[Math.floor(samples.length / 2)];
  assert.equal(
    Number.isFinite(
      median(this.durations.cachedSamples) /
        median(this.durations.uncachedSamples),
    ),
    true,
  );
});

After(function (this: StepWorld) {
  if (this.issue26Tui) this.issue26Tui.stop();
});
