const assert = require("node:assert/strict");
const { spawnSync } = require("node:child_process");
const { resolve } = require("node:path");
const { Given, Then, When } = require("@cucumber/cucumber");

function runProbe(inventory, text) {
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

Given("{word} のセリフ体候補がある画像経路", function (inventory) {
  this.fontInventory = inventory;
});

Given("CJK 対応セリフ体がない画像経路", function () {
  this.fontInventory = "fallback";
});

When("日本語の text を含む表示数式を Resvg まで組版する", function () {
  this.probe = runProbe(this.fontInventory, "それ以外");
});

When("ASCII の text を含む表示数式を Resvg まで組版する", function () {
  this.probe = runProbe(this.fontInventory, "otherwise");
});

Then("選んだセリフ体と日本語の組版尺度が Resvg へ渡る", function () {
  assert.deepEqual(this.probe, {
    image: true,
    pngSignature: "89504e470d0a1a0a",
    font: {
      loadSystemFonts: true,
      defaultFontFamily: "Noto Serif CJK JP",
      serifFamily: "Noto Serif CJK JP",
    },
    pathCount: 19,
    text: {
      value: "それ以外",
      family: "serif",
      size: "884px",
      baseline: "scale(1,-1)",
    },
    status: "serif: Noto Serif CJK JP",
  });
});

Then("{string} が表示数式のセリフ体に選ばれる", function (family) {
  assert.equal(this.probe.font.serifFamily, family);
});

Then("ASCII は従来どおりパスとして Resvg へ渡る", function () {
  assert.deepEqual(this.probe, {
    image: true,
    pngSignature: "89504e470d0a1a0a",
    font: {
      loadSystemFonts: true,
      defaultFontFamily: "Noto Serif CJK JP",
      serifFamily: "Noto Serif CJK JP",
    },
    pathCount: 26,
    text: null,
    status: "serif: Noto Serif CJK JP",
  });
});

Then("システムのセリフ体へ戻って日本語の PNG 描画を続ける", function () {
  assert.deepEqual(this.probe, {
    image: true,
    pngSignature: "89504e470d0a1a0a",
    font: { loadSystemFonts: true },
    pathCount: 19,
    text: {
      value: "それ以外",
      family: "serif",
      size: "884px",
      baseline: "scale(1,-1)",
    },
    status: "serif: system fallback",
  });
});
