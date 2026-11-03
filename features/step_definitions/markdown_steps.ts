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

function requireIssue26Frames(
  frames: { initial?: string; finalized?: string },
  frame: "initial" | "finalized" = "finalized",
): string {
  const rendered = frames[frame];
  if (rendered === undefined)
    throw new Error(`Issue 26 ${frame} frame has not been prepared`);
  return rendered;
}

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
  const deterministicTextCapabilities = {
    images: null,
    trueColor: true,
    hyperlinks: false,
  };
  setCapabilityOverrides(deterministicTextCapabilities);
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

Given(
  "Pi can render math through the image path",
  async function (this: StepWorld) {
    this.pi = fakePi();
    registerFormula(this.pi.api);
    this.started = await startWithKitty(this.pi);
  },
);

Given("register the ket and braket extra macros", function (this: StepWorld) {
  require("../../dist/api.js").registerFormula(this.pi.api, {
    ket: [String.raw`\left|#1\right\rangle`, 1],
    braket: [String.raw`\left\langle#1\right\rangle`, 1],
  });
});

Given(
  "Pi uses the image path with a braket user macro configured",
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
  "Pi uses the image path with an empty-string user macro configured",
  async function (this: StepWorld) {
    process.env.PI_FORMULA_MACROS = JSON.stringify({ empty: "" });
    this.pi = fakePi();
    registerFormula(this.pi.api);
    this.started = await startWithKitty(this.pi);
  },
);

Given(
  "Pi uses the image path with extra macros for testing substitution boundaries",
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
  "render dollar-delimited inline math containing the ket extra macro",
  function (this: StepWorld) {
    transform(this, String.raw`$\ket{s}$`);
    this.unicode = renderUnicode(this.rendered);
  },
);

When(
  "transform display math immediately after a colon",
  function (this: StepWorld) {
    transform(this, "Result:$$x = 1$$");
  },
);

When(
  "render the ket extra macro immediately after a colon",
  function (this: StepWorld) {
    transform(this, String.raw`State:$\ket{s}$`);
    this.unicode = renderUnicode(this.rendered);
  },
);

When(
  "render a shell variable in a URL followed by the ket extra macro",
  function (this: StepWorld) {
    transform(this, String.raw`https://example.com/$HOME の後は $\ket{s}$`);
    this.unicode = renderUnicode(this.rendered);
  },
);

When(
  "transform ket-like extra macro strings in scheme URLs and www URLs",
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
  "transform ket-like extra macro strings in scheme URLs without slashes",
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
  "render parenthesis-delimited inline math containing the braket extra macro",
  function (this: StepWorld) {
    transform(this, String.raw`\(\braket{s|\psi}\)`);
    this.unicode = renderUnicode(this.rendered);
  },
);

When(
  "render dollar-delimited inline math containing the braket user macro",
  function (this: StepWorld) {
    transform(this, String.raw`$\braket{s|\psi}$`);
    this.unicode = renderUnicode(this.rendered);
  },
);

When(
  "transform body text containing Object prototype names and the ket extra macro",
  function (this: StepWorld) {
    transform(this, String.raw`$\constructor{x}$ and $\ket{s}$`);
  },
);

When(
  "render body text with the ket extra macro after currency amounts and shell variables",
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
  "transform body text containing ket-like extra macro strings in relative Markdown URLs",
  function (this: StepWorld) {
    transform(this, String.raw`[doc](/guide/$\ket{s}$)`);
  },
);

When(
  "transform body text containing ket-like extra macro strings in URLs without schemes",
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
  "render inline math with a letter immediately after the ket extra macro",
  function (this: StepWorld) {
    transform(this, String.raw`$\ket{x}y$`);
    this.unicode = renderUnicode(this.rendered);
  },
);

When(
  "transform a squaring extra macro without grouping",
  function (this: StepWorld) {
    transform(this, String.raw`$\sq{a+b}$ / $\groupedSq{a+b}$`);
  },
);

When(
  "render inline math with whitespace and a letter after a zero-argument extra macro",
  function (this: StepWorld) {
    transform(this, String.raw`$\alpha x$`);
    this.unicode = renderUnicode(this.rendered);
  },
);

When(
  "transform body text with the letters ket after a backslash control symbol",
  function (this: StepWorld) {
    transform(this, String.raw`$\\ket{x}$`);
  },
);

When(
  "transform body text containing ket-like extra macro strings in reference link definitions",
  function (this: StepWorld) {
    transform(this, String.raw`[ket]: /guide/$\ket{s}$`);
  },
);

When(
  "transform body text containing ket-like extra macro strings in relative Markdown URLs with parentheses",
  function (this: StepWorld) {
    transform(this, String.raw`[doc](/guide/(v1)/$\ket{s}$)`);
  },
);

When(
  "render a Markdown table containing the ket extra macro",
  function (this: StepWorld) {
    transform(
      this,
      ["| 状態 |", "| --- |", String.raw`| $\ket{s}$ |`].join("\n"),
    );
    const passthroughTheme = new Proxy(
      {} as ConstructorParameters<typeof Markdown>[3],
      { get: () => (value: string) => value },
    );
    this.tableLines = new Markdown(
      this.rendered,
      0,
      0,
      passthroughTheme,
    ).render(80);
  },
);

When(
  "render inline math containing nested ket extra macros",
  function (this: StepWorld) {
    transform(this, String.raw`$\ket{\ket{x}}$`);
    this.unicode = renderUnicode(this.rendered);
  },
);

When(
  "transform inline math containing a self-referencing extra macro",
  function (this: StepWorld) {
    transform(this, String.raw`$\loop$`);
  },
);

When(
  "transform inline math containing an empty-string user macro",
  function (this: StepWorld) {
    transform(this, String.raw`$\empty$`);
  },
);

When(
  "transform a bare URL containing a parenthesis-delimited ket-like extra macro string",
  function (this: StepWorld) {
    transform(this, String.raw`https://example.com/\(\ket{s}\)`);
  },
);

When(
  "transform inline math containing an unregistered ket macro",
  function (this: StepWorld) {
    transform(this, String.raw`$\ket{s}$`);
  },
);

When(
  "transform inline math containing commands that cannot be rendered even after expansion",
  function (this: StepWorld) {
    transform(this, String.raw`$\ket{\notacommand{x}}$`);
  },
);

When(
  "transform body text with extra macros in code, currency amounts, URLs, and shell variables",
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

Then("The ket extra macro is rendered as Unicode", function (this: StepWorld) {
  assert.equal(this.unicode, "|s⟩");
});

Then(
  "Display math immediately after a colon becomes an image",
  function (this: StepWorld) {
    assert.equal(imageCount(this.rendered), 1);
  },
);

Then(
  "The ket extra macro immediately after a colon is rendered as Unicode",
  function (this: StepWorld) {
    assert.equal(this.unicode, "State:|s⟩");
  },
);

Then(
  "The shell variable in the URL remains and the following ket extra macro is rendered as Unicode",
  function (this: StepWorld) {
    assert.equal(this.unicode, "https://example.com/$HOME の後は |s⟩");
  },
);

Then("Scheme URLs and www URLs are unchanged", function (this: StepWorld) {
  assert.equal(this.rendered, this.source);
});

Then("Scheme URLs without slashes are unchanged", function (this: StepWorld) {
  assert.equal(this.rendered, this.source);
});

Then(
  "The braket extra macro is rendered as Unicode",
  function (this: StepWorld) {
    assert.equal(this.unicode, "⟨s|ψ⟩");
  },
);

Then(
  "The braket user macro is rendered as Unicode",
  function (this: StepWorld) {
    assert.equal(this.unicode, "⟨s|ψ⟩");
  },
);

Then(
  "Object prototype names remain and only the ket extra macro is expanded",
  function (this: StepWorld) {
    assert.equal(
      this.rendered,
      String.raw`$\constructor{x}$ and $\left\vert{}s\right\rangle$`,
    );
  },
);

Then(
  "Currency amounts and shell variables remain and the following ket extra macro is rendered as Unicode",
  function (this: StepWorld) {
    assert.equal(this.unicode, "価格は $5、状態は |s⟩。\n$HOME の後は |t⟩。");
  },
);

Then("Relative Markdown URLs are unchanged", function (this: StepWorld) {
  assert.equal(this.rendered, this.source);
});

Then("URLs without schemes are unchanged", function (this: StepWorld) {
  assert.equal(this.rendered, this.source);
});

Then(
  "The ket extra macro and following letter are rendered as Unicode",
  function (this: StepWorld) {
    assert.equal(this.unicode, "|x⟩y");
  },
);

Then(
  "The squaring extra macro argument is not automatically grouped",
  function (this: StepWorld) {
    assert.equal(this.rendered, "$a+b^2$ / $" + "{a+b}^2$");
  },
);

Then(
  "The zero-argument extra macro and following letter are rendered as Unicode",
  function (this: StepWorld) {
    assert.equal(this.unicode, "αx");
  },
);

Then(
  "Text after a backslash control symbol is unchanged",
  function (this: StepWorld) {
    assert.equal(this.rendered, this.source);
  },
);

Then("Reference link definitions are unchanged", function (this: StepWorld) {
  assert.equal(this.rendered, this.source);
});

Then(
  "Relative Markdown URLs containing parentheses are unchanged",
  function (this: StepWorld) {
    assert.equal(this.rendered, this.source);
  },
);

Then(
  "The ket extra macro is rendered as Unicode while preserving table columns",
  function (this: StepWorld) {
    const row = this.tableLines.find((line) => line.includes("|s⟩"));
    assert.equal((row?.match(/│/gu) ?? []).length, 2);
  },
);

Then(
  "Nested ket extra macros are rendered as Unicode",
  function (this: StepWorld) {
    assert.equal(this.unicode, "||x⟩⟩");
  },
);

Then("Recursive extra macros remain as source", function (this: StepWorld) {
  assert.equal(this.rendered, this.source);
});

Then(
  "The source remains instead of becoming empty inline math",
  function (this: StepWorld) {
    assert.equal(this.rendered, this.source);
  },
);

Then(
  "Bare URLs containing parenthesis delimiters are unchanged",
  function (this: StepWorld) {
    assert.equal(this.rendered, this.source);
  },
);

Then("An unregistered ket macro remains as source", function (this: StepWorld) {
  assert.equal(this.rendered, this.source);
});

Then("Unrenderable inline math remains as source", function (this: StepWorld) {
  assert.equal(this.rendered, this.source);
});

Then(
  "Protected content containing extra macros is unchanged",
  function (this: StepWorld) {
    assert.equal(this.rendered, this.source);
  },
);

When(
  "transform body text containing all four math delimiters",
  function (this: StepWorld) {
    transform(this, "$x$ と $$y$$ と \\(z\\) と \\[w\\]");
  },
);

When(
  "transform body text containing math in code fences and inline code",
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
  "transform code fences with long delimiters, indentation, and trailing whitespace",
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
  "transform code fences containing lines with regex metacharacters",
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

When("transform thinking body text", function (this: StepWorld) {
  transform(this, "考える: $$x$$", { messageType: "assistant-thinking" });
});

When(
  "transform body text containing currency amounts, URLs, shell variables, and escaped dollar signs",
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

When(
  "transform body text containing ambiguous dollar signs",
  function (this: StepWorld) {
    transform(this, "The values are $first and $second, not a formula.");
  },
);

When("transform display math in a list", function (this: StepWorld) {
  transform(this, "- 外側\n  - 式: $$\n    x^2\n    $$");
});

When("transform display math in a blockquote", function (this: StepWorld) {
  transform(this, "> 式: \\[\n> x^2\n> \\]");
});

When(
  "transform streaming body text received through a closed formula",
  function (this: StepWorld) {
    transform(this, "途中\n$$x$$\n続き", { isStreaming: true });
  },
);

When(
  "transform streaming body text received through an incomplete formula",
  function (this: StepWorld) {
    transform(this, "途中\n$$\\frac{1}{2}", { isStreaming: true });
  },
);

When(
  "transform body text containing non-math $$ followed by display math",
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

When("transform currency amounts containing $$", function (this: StepWorld) {
  transform(this, "価格は $$100 です。");
});

When(
  "transform body text containing rescanned currency amounts followed by display math",
  function (this: StepWorld) {
    const source =
      "前置き $$ は数式ではありません。\n価格は $$100\n\n$$x = 1$$";
    transform(this, source);
    this.actualFormulaImages = imageIdentities(this.rendered);
  },
);

When(
  'transform body text containing rescanned currency amounts with the colon label "{word}" followed by display math',
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
  "transform rescanned currency amounts, display math, and trailing shell $$",
  function (this: StepWorld) {
    transform(
      this,
      "前置き $$ は数式ではありません。\n価格は $$100\n\n$$x = 1$$\nrun echo $$",
    );
    this.actualFormulaBeforeShellImages = imageIdentities(this.rendered);
  },
);

When(
  "transform body text containing rescanned currency amounts and display math with standalone delimiter lines",
  function (this: StepWorld) {
    transform(
      this,
      "前置き $$ は数式ではありません。\n価格は $$100\n\n$$\nx = 1\n$$",
    );
    this.actualIndependentFormulaImages = imageIdentities(this.rendered);
  },
);

When(
  "transform body text containing non-math $$ followed by numeric-only display math",
  function (this: StepWorld) {
    transform(this, "前置き $$ は数式ではありません。\n\n$$100$$");
    this.actualNumericFormulaImages = imageIdentities(this.rendered);
  },
);

When(
  "transform non-math $$ and numeric display math whose closing delimiter is on a later line",
  function (this: StepWorld) {
    transform(this, "前置き $$ は数式ではありません。\n\n$$100\n$$");
    this.actualMultilineNumericFormulaImages = imageIdentities(this.rendered);
  },
);

When(
  "transform non-math $$ and numeric display math with an inline label",
  function (this: StepWorld) {
    transform(this, "前置き $$ は数式ではありません。\n式: $$100\n$$");
    this.actualLabeledNumericFormulaImages = imageIdentities(this.rendered);
  },
);

When(
  "transform non-math $$, numeric display math, a single letter, and following display math",
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
  "transform non-math $$, numeric display math, a single letter, and unclosed $$",
  function (this: StepWorld) {
    transform(this, "前置き $$ は数式ではありません。\n\n$$100\n$$\n\nx\n\n$$");
    this.actualNumericBeforeUnclosedImages = imageIdentities(this.rendered);
  },
);

When("transform ordinary display math", function (this: StepWorld) {
  transform(this, "$$a = b$$");
});

When("transform URLs containing $$", function (this: StepWorld) {
  transform(this, "https://example.com/a$$b$$c");
});

When(
  "transform body text containing shell $$ followed by display math",
  function (this: StepWorld) {
    transform(this, "run echo $$; kill $$ after 2 seconds.\n\n$$x = 1$$");
  },
);

When(
  "transform body text containing multiline shell $$ followed by display math",
  function (this: StepWorld) {
    transform(this, "run echo $$;\nkill $$ after 2 seconds.\n\n$$x = 1$$");
  },
);

When(
  "transform ordinary body text containing $$ at the start of a line followed by display math",
  function (this: StepWorld) {
    transform(
      this,
      "前置き $$ は数式ではありません。\n$$100 です。\n\n$$x = 1$$",
    );
  },
);

When(
  "transform body text containing non-math $$ and labeled display math",
  function (this: StepWorld) {
    transform(
      this,
      "閉じていない $$ は数式になりません。\n\n式: $$\nx = 1\n$$",
    );
  },
);

When(
  "transform body text containing ten thousand non-math $$",
  function (this: StepWorld) {
    const started = performance.now();
    transform(this, "$$通常本文\n".repeat(10_000));
    this.scanDuration = performance.now() - started;
  },
);

When(
  "transform body text containing invalid and valid display math",
  function (this: StepWorld) {
    transform(this, "$$\\notacommand{$$\n次の本文\n$$x$$");
  },
);

Then(
  "Dollar-delimited inline math remains in the transformed output",
  function (this: StepWorld) {
    assert.deepEqual(this.rendered.includes("$x$"), true);
  },
);

Then(
  "Parenthesis-delimited inline math remains in the transformed output",
  function (this: StepWorld) {
    assert.deepEqual(this.rendered.includes("\\(z\\)"), true);
  },
);

Then(
  "The two display formulas among the four delimiter types become images",
  function (this: StepWorld) {
    assert.deepEqual(imageCount(this.rendered), 2);
  },
);

Then("Body text inside code is unchanged", function (this: StepWorld) {
  assert.equal(this.rendered, this.source);
});

Then(
  "Display math inside long backtick fences remains",
  function (this: StepWorld) {
    assert.deepEqual(this.rendered.includes("$$backtick$$"), true);
  },
);

Then(
  "Display math inside long tilde fences remains",
  function (this: StepWorld) {
    assert.deepEqual(this.rendered.includes("$$tilde$$"), true);
  },
);

Then(
  "One display formula after long fences becomes an image",
  function (this: StepWorld) {
    assert.deepEqual(imageCount(this.rendered), 1);
  },
);

Then(
  "Backtick lines containing metacharacters do not close a fence",
  function (this: StepWorld) {
    assert.deepEqual(
      this.rendered.includes("$$afterBacktickMetacharacters$$"),
      true,
    );
  },
);

Then(
  "Tilde lines containing metacharacters do not close a fence",
  function (this: StepWorld) {
    assert.deepEqual(
      this.rendered.includes("$$afterTildeMetacharacters$$"),
      true,
    );
  },
);

Then(
  "One display formula after fences containing metacharacters becomes an image",
  function (this: StepWorld) {
    assert.deepEqual(imageCount(this.rendered), 1);
  },
);

Then("Thinking body text is unchanged", function (this: StepWorld) {
  assert.equal(this.rendered, this.source);
});

Then(
  "Body text containing ordinary dollar signs is unchanged",
  function (this: StepWorld) {
    assert.equal(this.rendered, this.source);
  },
);

Then(
  "Body text containing ambiguous dollar signs is unchanged",
  function (this: StepWorld) {
    assert.equal(this.rendered, this.source);
  },
);

Then("The image retains the list indentation", function (this: StepWorld) {
  assert.equal(placeholderLines(this.rendered)[0]?.startsWith("    "), true);
});

Then("The image retains the blockquote nesting", function (this: StepWorld) {
  assert.equal(placeholderLines(this.rendered)[0]?.startsWith("> "), true);
});

Then(
  "Closed display math is rendered through the image path",
  function (this: StepWorld) {
    assert.equal(imageCount(this.rendered), 1);
  },
);

Then("Incomplete math remains as source", function (this: StepWorld) {
  assert.equal(this.rendered, this.source);
});

Then(
  "Only the following display math becomes an image",
  function (this: StepWorld) {
    assert.equal(imageCount(this.rendered), 1);
  },
);

Then(
  "Skipped body text remains exactly once as supplied",
  function (this: StepWorld) {
    const skipped = "閉じていない $$ は数式になりません。\n\n## 行列指数\n\n";
    assert.equal(this.rendered.split(skipped).length - 1, 1);
  },
);

Then("Currency amounts remain as supplied", function (this: StepWorld) {
  assert.equal(this.rendered, this.source);
});

Then(
  "Only x = 1 is rendered through the image path",
  function (this: StepWorld) {
    assert.deepEqual(this.actualFormulaImages, this.expectedFormulaImages);
  },
);

Then(
  "Only x = 1 becomes an image after currency amounts with colons",
  function (this: StepWorld) {
    assert.deepEqual(
      this.actualLabeledAmountFormulaImages,
      this.expectedLabeledAmountFormulaImages,
    );
  },
);

Then(
  "Currency amounts with colon labels remain exactly once",
  function (this: StepWorld) {
    assert.deepEqual(this.rendered.split(this.labeledAmount).length - 1, 1);
  },
);

Then(
  "Only x = 1 becomes an image in body text containing currency amounts and shell text",
  function (this: StepWorld) {
    assert.deepEqual(
      this.actualFormulaBeforeShellImages,
      this.expectedFormulaBeforeShellImages,
    );
  },
);

Then(
  "Currency amounts in body text containing display math and shell text remain exactly once",
  function (this: StepWorld) {
    assert.deepEqual(this.rendered.split("価格は $$100").length - 1, 1);
  },
);

Then(
  "Shell $$ in body text containing display math and currency amounts remains exactly once",
  function (this: StepWorld) {
    assert.deepEqual(this.rendered.split("run echo $$").length - 1, 1);
  },
);

Then(
  "Only x = 1 becomes an image with standalone delimiter lines",
  function (this: StepWorld) {
    assert.deepEqual(
      this.actualIndependentFormulaImages,
      this.expectedIndependentFormulaImages,
    );
  },
);

Then(
  "Currency amounts before standalone display math remain exactly once",
  function (this: StepWorld) {
    assert.deepEqual(this.rendered.split("価格は $$100").length - 1, 1);
  },
);

Then("Only 100 is rendered through the image path", function (this: StepWorld) {
  assert.deepEqual(
    this.actualNumericFormulaImages,
    this.expectedNumericFormulaImages,
  );
});

Then(
  "Only multiline-delimited 100 is rendered through the image path",
  function (this: StepWorld) {
    assert.deepEqual(
      this.actualMultilineNumericFormulaImages,
      this.expectedMultilineNumericFormulaImages,
    );
  },
);

Then(
  "Only labeled 100 is rendered through the image path",
  function (this: StepWorld) {
    assert.deepEqual(
      this.actualLabeledNumericFormulaImages,
      this.expectedLabeledNumericFormulaImages,
    );
  },
);

Then(
  "Only numeric math and the following y = 1 become images",
  function (this: StepWorld) {
    assert.deepEqual(
      this.actualSeparatedFormulaImages,
      this.expectedSeparatedFormulaImages,
    );
  },
);

Then(
  "The single letter between two display formulas remains exactly once",
  function (this: StepWorld) {
    assert.deepEqual(this.rendered.split("\nx\n").length - 1, 1);
  },
);

Then(
  "Only 100 before the incomplete delimiter becomes an image",
  function (this: StepWorld) {
    assert.deepEqual(
      this.actualNumericBeforeUnclosedImages,
      this.expectedNumericBeforeUnclosedImages,
    );
  },
);

Then(
  "The single letter between the incomplete delimiter and numeric math remains exactly once",
  function (this: StepWorld) {
    assert.deepEqual(this.rendered.split("\nx\n").length - 1, 1);
  },
);

Then(
  "The incomplete delimiter after numeric math remains",
  function (this: StepWorld) {
    assert.deepEqual(this.rendered.endsWith("$$"), true);
  },
);

Then("One display formula becomes an image", function (this: StepWorld) {
  assert.equal(imageCount(this.rendered), 1);
});

Then("URLs remain as supplied", function (this: StepWorld) {
  assert.equal(this.rendered, this.source);
});

Then(
  "Ordinary shell body text remains as supplied",
  function (this: StepWorld) {
    const shellText = "run echo $$; kill $$ after 2 seconds.";
    assert.equal(this.rendered.split(shellText).length - 1, 1);
  },
);

Then(
  "One display formula following shell text becomes an image",
  function (this: StepWorld) {
    assert.deepEqual(imageCount(this.rendered), 1);
  },
);

Then(
  "The LaTeX for x = 1 following shell text does not remain in the transformed output",
  function (this: StepWorld) {
    assert.deepEqual(this.rendered.includes("x = 1"), false);
  },
);

Then(
  "Ordinary multiline shell body text remains as supplied",
  function (this: StepWorld) {
    const shellText = "run echo $$;\nkill $$ after 2 seconds.";
    assert.equal(this.rendered.split(shellText).length - 1, 1);
  },
);

Then(
  "Ordinary body text containing $$ at the start of a line remains as supplied",
  function (this: StepWorld) {
    const text = "前置き $$ は数式ではありません。\n$$100 です。";
    assert.equal(this.rendered.split(text).length - 1, 1);
  },
);

Then(
  "One display formula following non-math $$ becomes an image",
  function (this: StepWorld) {
    assert.deepEqual(imageCount(this.rendered), 1);
  },
);

Then(
  "The LaTeX for x = 1 following non-math $$ does not remain in the transformed output",
  function (this: StepWorld) {
    assert.deepEqual(this.rendered.includes("x = 1"), false);
  },
);

Then(
  "Body text before labeled display math remains exactly once as supplied",
  function (this: StepWorld) {
    const text = "閉じていない $$ は数式になりません。\n\n式: ";
    assert.equal(this.rendered.split(text).length - 1, 1);
  },
);

Then("Scanning finishes within one second", function (this: StepWorld) {
  assert.ok(this.scanDuration < 1_000, `${this.scanDuration}ms`);
});

Then(
  "Invalid display math remains in the transformed output",
  function (this: StepWorld) {
    assert.deepEqual(this.rendered.includes("$$\\notacommand{$$"), true);
  },
);

Then(
  "Body text following invalid display math remains in the transformed output",
  function (this: StepWorld) {
    assert.deepEqual(this.rendered.includes("次の本文"), true);
  },
);

Then(
  "One valid formula after invalid display math becomes an image",
  function (this: StepWorld) {
    assert.deepEqual(imageCount(this.rendered), 1);
  },
);

Given(
  "read the pi-formula image processing settings",
  function (this: StepWorld) {
    this.safetyLimits =
      require("../../dist/typesetter.js").FORMULA_SAFETY_LIMITS;
  },
);

When("inspect the fixed limits", function (this: StepWorld) {
  this.limitValues = Object.values(this.safetyLimits ?? {});
});

Then(
  "The image processing safety limits contain the 7 defined fields",
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
  "All image processing safety limits are finite positive integers",
  function (this: StepWorld) {
    assert.deepEqual(
      this.limitValues.every(
        (value) => Number.isSafeInteger(value) && value > 0,
      ),
      true,
    );
  },
);

When("transform over-limit and valid display math", function (this: StepWorld) {
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
});

Then(
  "Math exceeding the input character limit remains in the transformed output",
  function (this: StepWorld) {
    assert.deepEqual(this.rendered.includes(this.oversizedLatex), true);
  },
);

Then(
  "Math exceeding the image row limit remains in the transformed output",
  function (this: StepWorld) {
    assert.deepEqual(this.rendered.includes(this.tooTallLatex), true);
  },
);

Then(
  "One valid formula after an over-limit formula becomes an image",
  function (this: StepWorld) {
    assert.deepEqual(imageCount(this.rendered), 1);
  },
);

When(
  "transform display math scaled below half the baseline and valid display math",
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

Then(
  "Math with unreadable scaling remains in the transformed output",
  function (this: StepWorld) {
    assert.deepEqual(this.rendered.includes(this.smallLatex), true);
  },
);

Then(
  "One valid formula after unreadably scaled math becomes an image",
  function (this: StepWorld) {
    assert.deepEqual(imageCount(this.rendered), 1);
  },
);

When(
  "render the theme and width comparison formula at {int} columns",
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
  "Each change to theme color or display width produces a separate cache entry",
  function (this: StepWorld) {
    assert.equal(new Set(this.imageIdentities).size, 3);
  },
);

Given(
  "Pi uses an image path that does not return exact RGB",
  async function (this: StepWorld) {
    this.pi = fakePi();
    registerFormula(this.pi.api);
    await startWithKitty(this.pi, {
      foregroundAnsi: "\x1b[38;5;250m",
      foregroundResponse: "rgb:invalid",
    });
  },
);

When("transform display math", function (this: StepWorld) {
  transform(this, "$$x_{rgb}$$");
});

Then(
  "Math without available RGB remains as source",
  function (this: StepWorld) {
    assert.equal(this.rendered, this.source);
  },
);

Given("an image cache has a 3-entry limit", function (this: StepWorld) {
  const {
    RenderCache,
  }: typeof import("../../dist/render-cache.js") = require("../../dist/render-cache.js");
  this.renderCache = new RenderCache(3, 10_000);
  this.cacheCreates = new Map();

  this.cacheImageBytes = 20;
});

When(
  "retrieve image {word} from the cache",
  function (this: StepWorld, key: string) {
    this.renderCache.getOrCreate(key, () => {
      this.cacheCreates.set(key, (this.cacheCreates.get(key) ?? 0) + 1);
      return cacheImage(this.cacheImageBytes);
    });
    this.cacheStats = this.renderCache.stats();
  },
);

Then(
  "The oldest entry is recreated after exceeding the entry limit",
  function (this: StepWorld) {
    assert.deepEqual(this.cacheCreates.get("a"), 2);
  },
);

Then(
  "The recently used second cache entry is not recreated",
  function (this: StepWorld) {
    assert.deepEqual(this.cacheCreates.get("b"), 1);
  },
);

Then("The image cache stays within 3 entries", function (this: StepWorld) {
  assert.deepEqual(this.cacheStats.entries <= 3, true);
});

Given("an image cache has a 300-byte limit", function (this: StepWorld) {
  const {
    RenderCache,
  }: typeof import("../../dist/render-cache.js") = require("../../dist/render-cache.js");
  this.renderCache = new RenderCache(10, 300);
  this.cacheCreates = new Map();

  this.cacheImageBytes = 80;
});

Then(
  "The oldest entry is recreated after exceeding the byte limit",
  function (this: StepWorld) {
    assert.deepEqual(this.cacheCreates.get("a"), 2);
  },
);

Then(
  "Only the last entry remains after exceeding the cache byte limit",
  function (this: StepWorld) {
    assert.deepEqual(this.cacheStats.entries, 1);
  },
);

Then("The image cache stays within 300 bytes", function (this: StepWorld) {
  assert.deepEqual(this.cacheStats.bytes <= 300, true);
});

Given(
  "a cache can count image result creation calls",
  function (this: StepWorld) {
    const {
      RenderCache,
    }: typeof import("../../dist/render-cache.js") = require("../../dist/render-cache.js");
    this.renderCache = new RenderCache(3, 300);
    this.failedCreates = 0;
  },
);

When(
  "retrieve the same failed entry from the cache",
  function (this: StepWorld) {
    this.renderCache.getOrCreate("failure", () => {
      this.failedCreates += 1;
      throw new Error("invalid LaTeX");
    });
  },
);

Then(
  "The same failed entry is processed as an image only once",
  function (this: StepWorld) {
    assert.equal(this.failedCreates, 1);
  },
);

When(
  "render reproduction body frames through frame {int}",
  function (this: StepWorld, count: number) {
    if (count < 1 || count > 4)
      throw new Error(`unknown reproduction frame: ${count}`);
    this.streamingFormulaFrames ??= [];
    this.streamingFormulaFrames.push(renderStreamingFrame(this.pi, count));
  },
);

Then(
  "The transformed output image transfer counts are 1, 2, 3, and 4 in order",
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
  "render the preceding qni tool call and result in the TUI",
  function (this: StepWorld) {
    this.issue26Tui = tuiUpdates(["qni tool call", "qni tool result"]);
    this.issue26Updates.tuiWrites.initial = this.issue26Tui.render("");
  },
);

Then("The preceding tool rendering remains", function (this: StepWorld) {
  assert.equal(
    requireIssue26Frames(this.issue26Updates.tuiWrites, "initial").includes(
      "qni tool result",
    ),
    true,
  );
});

Then(
  "The number of display formulas rendered through the image path increases one at a time",
  function (this: StepWorld) {
    assert.deepEqual(this.issue26Updates.streaming.map(imageCount), [1, 2, 3]);
  },
);

Then(
  "Each differential render transfers one new display formula",
  function (this: StepWorld) {
    assert.deepEqual(
      [
        ...this.issue26Updates.tuiWrites.streaming.map(imageCount),
        imageCount(requireIssue26Frames(this.issue26Updates.tuiWrites)),
      ],
      [1, 1, 1, 0],
    );
  },
);

Then(
  "Incremental update image IDs match the image IDs of each transfer",
  function (this: StepWorld) {
    const frames = [
      ...this.issue26Updates.streaming,
      requireIssue26Frames(this.issue26Updates),
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
  "place the same multiline display formula twice in one final response",
  function (this: StepWorld) {
    const formula = String.raw`$$\begin{pmatrix}1&0\\0&1\end{pmatrix}$$`;
    transform(this, [formula, "端末上の画像を破棄", formula].join("\n\n"));
    this.cachedPlacementBlocks = inspectPlacementBlocks(this.rendered);
  },
);

Then(
  "The same response contains 2 image placements",
  function (this: StepWorld) {
    assert.equal(this.cachedPlacementBlocks.length, 2);
  },
);

When(
  "transform display math while monitoring external side effects",
  function (this: StepWorld) {
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
  },
);

Then(
  "Image conversion does not write files, call external services, or spawn child processes",
  function (this: StepWorld) {
    assert.deepEqual(this.externalCalls, []);
  },
);

Then(
  "Image conversion does not load browser modules",
  function (this: StepWorld) {
    assert.deepEqual(this.browserModules, []);
  },
);

Then(
  "One display formula can become an image even when external side effects are prohibited",
  function (this: StepWorld) {
    assert.deepEqual(imageCount(this.rendered), 1);
  },
);

Given(
  "Pi has loaded and registered the extension in a fresh Node.js process",
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

When(
  "transform display math exceeding the input limit",
  async function (this: StepWorld) {
    const source = `$$${"x".repeat(this.safetyLimits.latexCharacters + 1)}$$`;
    const result = await this.isolatedRenderer.request("render", {
      markdown: source,
    });
    this.oversizedPreparation = {
      keyCreations: result.keyCreations,
      prepared: result.loaded,
      unchanged: result.markdown === source,
    };
  },
);

Then(
  "No cache key is created for math exceeding the input character limit",
  function (this: StepWorld) {
    assert.deepEqual(this.oversizedPreparation.keyCreations, 0);
  },
);

Then(
  "Math exceeding the input character limit does not initialize image processing components",
  function (this: StepWorld) {
    assert.deepEqual(this.oversizedPreparation.prepared, false);
  },
);

Then(
  "Math exceeding the input character limit remains as source",
  function (this: StepWorld) {
    assert.deepEqual(this.oversizedPreparation.unchanged, true);
  },
);

When(
  "transform display math for the first time",
  async function (this: StepWorld) {
    const result = await this.isolatedRenderer.request("render", {
      markdown: "$$x_{lazy}$$",
    });
    this.lazyPreparation.afterFormula = result.loaded;
  },
);

Then(
  "Neither MathJax nor Resvg is loaded before rendering math",
  function (this: StepWorld) {
    assert.deepEqual(this.lazyPreparation.before, false);
  },
);

Then(
  "Starting a session alone does not load MathJax or Resvg",
  function (this: StepWorld) {
    assert.deepEqual(this.lazyPreparation.afterSessionStart, false);
  },
);

Then(
  "The first display formula loads MathJax and Resvg",
  function (this: StepWorld) {
    assert.deepEqual(this.lazyPreparation.afterFormula, true);
  },
);

When(
  "measure conversion times for 5 different uncached formulas",
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
  "The cached median is less than 5 percent of the uncached median",
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

When("first render reference display formula 1", function (this: StepWorld) {
  transform(this, "$$x = 1$$");
  this.expectedFormulaImages = imageIdentities(this.rendered);
});

When("first render the reference x = 1", function (this: StepWorld) {
  transform(this, "$$x = 1$$");
  this.expectedLabeledAmountFormulaImages = imageIdentities(this.rendered);
});

When("first render reference display formula 2", function (this: StepWorld) {
  transform(this, "$$x = 1$$");
  this.expectedFormulaBeforeShellImages = imageIdentities(this.rendered);
});

When("first render reference display formula 3", function (this: StepWorld) {
  transform(this, "$$\nx = 1\n$$");
  this.expectedIndependentFormulaImages = imageIdentities(this.rendered);
});

When("first render reference display formula 4", function (this: StepWorld) {
  transform(this, "$$100$$");
  this.expectedNumericFormulaImages = imageIdentities(this.rendered);
});

When("first render reference display formula 5", function (this: StepWorld) {
  transform(this, "$$100\n$$");
  this.expectedMultilineNumericFormulaImages = imageIdentities(this.rendered);
});

When("first render reference display formula 6", function (this: StepWorld) {
  transform(this, "$$100\n$$");
  this.expectedLabeledNumericFormulaImages = imageIdentities(this.rendered);
});

When("first render reference display formula 7", function (this: StepWorld) {
  transform(this, "$$100\n$$");
  this.expectedNumericBeforeUnclosedImages = imageIdentities(this.rendered);
});

When("first render the reference number 100", function (this: StepWorld) {
  transform(this, "$$100\n$$");
  this.referenceNumericImages = imageIdentities(this.rendered);
});

When("next render the reference y = 1", function (this: StepWorld) {
  transform(this, "$$y = 1$$");
  this.referenceFollowingImages = imageIdentities(this.rendered);
});

When(
  "change the theme text color to RGB 10, 20, 30",
  function (this: StepWorld) {
    this.started.setTextColor("\x1b[38;2;10;20;30m");
  },
);

When(
  "restore the theme text color to RGB 212, 212, 212",
  function (this: StepWorld) {
    this.started.setTextColor("\x1b[38;2;212;212;212m");
  },
);

Then(
  "The theme and width comparison produces 3 image IDs",
  function (this: StepWorld) {
    assert.deepEqual(this.imageIdentities.map(Boolean), [true, true, true]);
  },
);

Then(
  "The terminal render transfer line counts are 1, 2, 3, and 4 in order",
  function (this: StepWorld) {
    assert.deepEqual(
      inspectStreamingRegression(this.streamingFormulaFrames).map(
        (frame) => frame.transferLineCount,
      ),
      [1, 2, 3, 4],
    );
  },
);

Then(
  "Each transfer line contains only one image transfer",
  function (this: StepWorld) {
    assert.deepEqual(
      inspectStreamingRegression(this.streamingFormulaFrames).map(
        (frame) => frame.oneTransferPerLine,
      ),
      [true, true, true, true],
    );
  },
);

Then("Each frame transfer chunks are complete", function (this: StepWorld) {
  assert.deepEqual(
    inspectStreamingRegression(this.streamingFormulaFrames).map(
      (frame) => frame.completeChunks,
    ),
    [true, true, true, true],
  );
});

Then(
  "Each frame image ID matches its placement ID",
  function (this: StepWorld) {
    assert.deepEqual(
      inspectStreamingRegression(this.streamingFormulaFrames).map(
        (frame) => frame.matchingPlacementIds,
      ),
      [true, true, true, true],
    );
  },
);

Then(
  "Each frame placeholder row count corresponds to its image transfer",
  function (this: StepWorld) {
    assert.deepEqual(
      inspectStreamingRegression(this.streamingFormulaFrames).map(
        (frame) => frame.matchingPlaceholderRows,
      ),
      [true, true, true, true],
    );
  },
);

Then(
  "Each frame placement is adjacent to its transfer",
  function (this: StepWorld) {
    assert.deepEqual(
      inspectStreamingRegression(this.streamingFormulaFrames).map(
        (frame) => frame.adjacentPlacements,
      ),
      [true, true, true, true],
    );
  },
);

Given(
  "the Issue 26 corpus and ket extra macro exist",
  function (this: StepWorld) {
    require("../../dist/api.js").registerFormula(this.pi.api, {
      ket: [String.raw`\left|#1\right\rangle`, 1],
    });
    this.issue26Source = issue26Source();
    this.issue26Updates = { streaming: [], tuiWrites: { streaming: [] } };
  },
);

When(
  "transform incomplete bodies through body {int} from Issue 26",
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

When("transform the final body from Issue 26", function (this: StepWorld) {
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
  "update the TUI with incomplete body {int} from Issue 26",
  function (this: StepWorld, count: number) {
    this.issue26Updates.tuiWrites.streaming.push(
      this.issue26Tui.render(this.issue26Updates.streaming[count - 1]),
    );
  },
);

When(
  "update the TUI with the final body from Issue 26",
  function (this: StepWorld) {
    this.issue26Updates.tuiWrites.finalized = this.issue26Tui.render(
      requireIssue26Frames(this.issue26Updates),
    );
  },
);

Then(
  "Incremental update placeholder rows match the declared rows of each transfer",
  function (this: StepWorld) {
    const frames = [
      ...this.issue26Updates.streaming,
      requireIssue26Frames(this.issue26Updates),
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
  "Transfer chunks for each incremental update placement are complete",
  function (this: StepWorld) {
    const frames = [
      ...this.issue26Updates.streaming,
      requireIssue26Frames(this.issue26Updates),
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
  "Each incremental update placement is adjacent to its transfer",
  function (this: StepWorld) {
    const frames = [
      ...this.issue26Updates.streaming,
      requireIssue26Frames(this.issue26Updates),
    ];
    assert.deepEqual(
      frames.map((frame) =>
        inspectPlacementBlocks(frame).map((block) => block.adjacentTransfer),
      ),
      [[true], [true, true], [true, true, true], [true, true, true]],
    );
  },
);

Then(
  "Each placement in the same response uses the same image ID",
  function (this: StepWorld) {
    assert.deepEqual(
      this.cachedPlacementBlocks.map((block) => block.id),
      [this.cachedPlacementBlocks[0]?.id, this.cachedPlacementBlocks[0]?.id],
    );
  },
);

Then(
  "Each placement in the same response spans multiple rows",
  function (this: StepWorld) {
    assert.deepEqual(
      this.cachedPlacementBlocks.map((block) => block.rows > 1),
      [true, true],
    );
  },
);

Then(
  "Cached image IDs match the image IDs of each transfer",
  function (this: StepWorld) {
    assert.deepEqual(
      this.cachedPlacementBlocks.map((block) => block.id === block.transferId),
      [true, true],
    );
  },
);

Then(
  "Cached image placeholder rows match the declared rows of each transfer",
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
  "Transfer chunks for each cached image placement are complete",
  function (this: StepWorld) {
    assert.deepEqual(
      this.cachedPlacementBlocks.map((block) => block.completeTransfer),
      [true, true],
    );
  },
);

Then(
  "Each cached image placement is adjacent to its transfer",
  function (this: StepWorld) {
    assert.deepEqual(
      this.cachedPlacementBlocks.map((block) => block.adjacentTransfer),
      [true, true],
    );
  },
);

Given(
  "the environment fails when a cache key is created",
  function (this: StepWorld) {
    this.blockKeyCreation = true;
  },
);

When(
  "start an image path session in an isolated process",
  async function (this: StepWorld) {
    const result = await this.isolatedRenderer.request("start");
    this.lazyPreparation.afterSessionStart = result.loaded;
  },
);

When(
  "render the initialization formula in an isolated process",
  async function (this: StepWorld) {
    await this.isolatedRenderer.request("render", {
      markdown: "$$x_{warmup}$$",
    });
  },
);

When(
  "measure the last cached formula 10 times",
  async function (this: StepWorld) {
    for (let index = 0; index < 10; index++) {
      const result = await this.isolatedRenderer.request("render", {
        markdown: "$$x_{cold5}$$",
      });
      this.durations.cachedSamples.push(result.duration);
    }
  },
);

Then("There are 5 uncached formula measurements", function (this: StepWorld) {
  assert.equal(this.durations.uncachedSamples.length, 5);
});

Then("There are 10 cached formula measurements", function (this: StepWorld) {
  assert.equal(this.durations.cachedSamples.length, 10);
});

Then("The cached median ratio is finite", function (this: StepWorld) {
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
