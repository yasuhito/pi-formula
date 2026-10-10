interface TypesettingProbe {
  image: boolean;
  pngSignature: string;
  font: NonNullable<import("@resvg/resvg-js").ResvgRenderOptions["font"]>;
  pathCount: number;
  text: {
    value: string;
    family?: string;
    size?: string;
    baseline?: string;
  } | null;
  status: string | undefined;
}

interface StepWorld {
  fontInventory: string;
  probe: TypesettingProbe;
}

const assert: typeof import("node:assert/strict") = require("node:assert/strict");
const {
  spawnSync,
}: typeof import("node:child_process") = require("node:child_process");
const { resolve }: typeof import("node:path") = require("node:path");
const {
  Given,
  Then,
  When,
}: typeof import("@cucumber/cucumber") = require("@cucumber/cucumber");

function runProbe(inventory: string, text: string): TypesettingProbe {
  const result = spawnSync(
    process.execPath,
    [
      resolve(__dirname, "../../test/support/typesetting-probe.js"),
      inventory,
      text,
    ],
    { encoding: "utf8" },
  );
  if (result.status !== 0) throw new Error(result.stderr);
  return JSON.parse(result.stdout);
}

Given(
  "{word} のセリフ体候補がある画像経路",
  function (this: StepWorld, inventory: string) {
    this.fontInventory = inventory;
  },
);

Given("CJK 対応セリフ体がない画像経路", function (this: StepWorld) {
  this.fontInventory = "fallback";
});

When(
  "日本語の text を含む表示数式を Resvg まで組版する",
  function (this: StepWorld) {
    this.probe = runProbe(this.fontInventory, "それ以外");
  },
);

When(
  "ASCII の text を含む表示数式を Resvg まで組版する",
  function (this: StepWorld) {
    this.probe = runProbe(this.fontInventory, "otherwise");
  },
);

Then("優先候補の日本語の表示数式は画像になる", function (this: StepWorld) {
  assert.deepEqual(this.probe.image, true);
});

Then("優先候補の日本語の画像にはPNG署名がある", function (this: StepWorld) {
  assert.deepEqual(this.probe.pngSignature, "89504e470d0a1a0a");
});

Then(
  "日本語の組版には優先候補のセリフ体設定がResvgへ渡る",
  function (this: StepWorld) {
    assert.deepEqual(this.probe.font, {
      loadSystemFonts: true,
      defaultFontFamily: "Noto Serif CJK JP",
      serifFamily: "Noto Serif CJK JP",
    });
  },
);

Then("優先候補の日本語のSVGには19個のpathがある", function (this: StepWorld) {
  assert.deepEqual(this.probe.pathCount, 19);
});

Then("日本語のtextの内容と尺度はResvgへ渡る", function (this: StepWorld) {
  assert.deepEqual(this.probe.text, {
    value: "それ以外",
    family: "serif",
    size: "884px",
    baseline: "scale(1,-1)",
  });
});

Then(
  "診断には日本語に選んだ優先候補のセリフ体が表示される",
  function (this: StepWorld) {
    assert.deepEqual(this.probe.status, "serif: Noto Serif CJK JP");
  },
);

Then(
  "{string} が表示数式のセリフ体に選ばれる",
  function (this: StepWorld, family: string) {
    assert.equal(this.probe.font.serifFamily, family);
  },
);

Then("ASCIIの表示数式は画像になる", function (this: StepWorld) {
  assert.deepEqual(this.probe.image, true);
});

Then("ASCIIの画像にはPNG署名がある", function (this: StepWorld) {
  assert.deepEqual(this.probe.pngSignature, "89504e470d0a1a0a");
});

Then(
  "ASCIIの組版には優先候補のセリフ体設定がResvgへ渡る",
  function (this: StepWorld) {
    assert.deepEqual(this.probe.font, {
      loadSystemFonts: true,
      defaultFontFamily: "Noto Serif CJK JP",
      serifFamily: "Noto Serif CJK JP",
    });
  },
);

Then("ASCIIのSVGには26個のpathがある", function (this: StepWorld) {
  assert.deepEqual(this.probe.pathCount, 26);
});

Then("ASCIIの組版にSVGのtextは含まれない", function (this: StepWorld) {
  assert.deepEqual(this.probe.text, null);
});

Then("診断にはASCIIに選んだセリフ体が表示される", function (this: StepWorld) {
  assert.deepEqual(this.probe.status, "serif: Noto Serif CJK JP");
});

Then(
  "候補のセリフ体がなくても日本語の表示数式は画像になる",
  function (this: StepWorld) {
    assert.deepEqual(this.probe.image, true);
  },
);

Then(
  "候補のセリフ体がない日本語の画像にもPNG署名がある",
  function (this: StepWorld) {
    assert.deepEqual(this.probe.pngSignature, "89504e470d0a1a0a");
  },
);

Then("候補のセリフ体がない組版はsystem fontを使う", function (this: StepWorld) {
  assert.deepEqual(this.probe.font, { loadSystemFonts: true });
});

Then(
  "候補のセリフ体がない日本語のSVGには19個のpathがある",
  function (this: StepWorld) {
    assert.deepEqual(this.probe.pathCount, 19);
  },
);

Then(
  "system fontでも日本語のtextの内容と尺度はResvgへ渡る",
  function (this: StepWorld) {
    assert.deepEqual(this.probe.text, {
      value: "それ以外",
      family: "serif",
      size: "884px",
      baseline: "scale(1,-1)",
    });
  },
);

Then("診断にはsystem fontへのfallbackが表示される", function (this: StepWorld) {
  assert.deepEqual(this.probe.status, "serif: system fallback");
});
