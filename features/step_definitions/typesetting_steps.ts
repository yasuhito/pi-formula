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
  "an image path with {word} serif font candidates",
  function (this: StepWorld, inventory: string) {
    this.fontInventory = inventory;
  },
);

Given(
  "an image path without a CJK-capable serif font",
  function (this: StepWorld) {
    this.fontInventory = "fallback";
  },
);

When(
  "typeset display math containing Japanese text through Resvg",
  function (this: StepWorld) {
    this.probe = runProbe(this.fontInventory, "それ以外");
  },
);

When(
  "typeset display math containing ASCII text through Resvg",
  function (this: StepWorld) {
    this.probe = runProbe(this.fontInventory, "otherwise");
  },
);

Then(
  "Japanese display math using the preferred candidate becomes an image",
  function (this: StepWorld) {
    assert.deepEqual(this.probe.image, true);
  },
);

Then(
  "The Japanese image using the preferred candidate has a PNG signature",
  function (this: StepWorld) {
    assert.deepEqual(this.probe.pngSignature, "89504e470d0a1a0a");
  },
);

Then(
  "The preferred serif font settings are passed to Resvg for Japanese typesetting",
  function (this: StepWorld) {
    assert.deepEqual(this.probe.font, {
      loadSystemFonts: true,
      defaultFontFamily: "Noto Serif CJK JP",
      serifFamily: "Noto Serif CJK JP",
    });
  },
);

Then(
  "The Japanese SVG using the preferred candidate contains 19 paths",
  function (this: StepWorld) {
    assert.deepEqual(this.probe.pathCount, 19);
  },
);

Then(
  "Japanese text content and scale are passed to Resvg",
  function (this: StepWorld) {
    assert.deepEqual(this.probe.text, {
      value: "それ以外",
      family: "serif",
      size: "884px",
      baseline: "scale(1,-1)",
    });
  },
);

Then(
  "Diagnostics show the preferred serif font selected for Japanese",
  function (this: StepWorld) {
    assert.deepEqual(this.probe.status, "serif: Noto Serif CJK JP");
  },
);

Then(
  "{string} is selected as the display math serif font",
  function (this: StepWorld, family: string) {
    assert.equal(this.probe.font.serifFamily, family);
  },
);

Then("ASCII display math becomes an image", function (this: StepWorld) {
  assert.deepEqual(this.probe.image, true);
});

Then("The ASCII image has a PNG signature", function (this: StepWorld) {
  assert.deepEqual(this.probe.pngSignature, "89504e470d0a1a0a");
});

Then(
  "The preferred serif font settings are passed to Resvg for ASCII typesetting",
  function (this: StepWorld) {
    assert.deepEqual(this.probe.font, {
      loadSystemFonts: true,
      defaultFontFamily: "Noto Serif CJK JP",
      serifFamily: "Noto Serif CJK JP",
    });
  },
);

Then("The ASCII SVG contains 26 paths", function (this: StepWorld) {
  assert.deepEqual(this.probe.pathCount, 26);
});

Then("The typeset ASCII contains no SVG text", function (this: StepWorld) {
  assert.deepEqual(this.probe.text, null);
});

Then(
  "Diagnostics show the serif font selected for ASCII",
  function (this: StepWorld) {
    assert.deepEqual(this.probe.status, "serif: Noto Serif CJK JP");
  },
);

Then(
  "Japanese display math becomes an image even without serif font candidates",
  function (this: StepWorld) {
    assert.deepEqual(this.probe.image, true);
  },
);

Then(
  "The Japanese image without serif font candidates also has a PNG signature",
  function (this: StepWorld) {
    assert.deepEqual(this.probe.pngSignature, "89504e470d0a1a0a");
  },
);

Then(
  "Typesetting without serif font candidates uses system fonts",
  function (this: StepWorld) {
    assert.deepEqual(this.probe.font, { loadSystemFonts: true });
  },
);

Then(
  "The Japanese SVG without serif font candidates contains 19 paths",
  function (this: StepWorld) {
    assert.deepEqual(this.probe.pathCount, 19);
  },
);

Then(
  "Japanese text content and scale are passed to Resvg even with system fonts",
  function (this: StepWorld) {
    assert.deepEqual(this.probe.text, {
      value: "それ以外",
      family: "serif",
      size: "884px",
      baseline: "scale(1,-1)",
    });
  },
);

Then(
  "Diagnostics show the fallback to system fonts",
  function (this: StepWorld) {
    assert.deepEqual(this.probe.status, "serif: system fallback");
  },
);
