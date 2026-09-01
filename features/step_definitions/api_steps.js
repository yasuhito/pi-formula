const assert = require("node:assert/strict");
const { mkdirSync, rmSync, writeFileSync } = require("node:fs");
const { mkdtempSync } = require("node:fs");
const { tmpdir } = require("node:os");
const { join } = require("node:path");
const { After, Before, Given, Then, When } = require("@cucumber/cucumber");

const { createPngFromScanlines } = require("../../test/support/png-fixture.js");
const {
  fakePi,
  resetFormulaState,
  startWithKitty,
  startWithText,
} = require("../../test/support/fake-pi");
const {
  loadIntegrationExtension,
  registerIntegrationExtension,
} = require("../../test/support/integration-extension");
const {
  loadStandaloneExtension,
} = require("../../test/support/standalone-extension");

const apiPath = require.resolve("../..");

function freshApi() {
  delete require.cache[apiPath];
  return require(apiPath);
}

function writeConfig(world, macros) {
  const directory = join(world.xdg, "pi-formula");
  mkdirSync(directory, { recursive: true });
  writeFileSync(join(directory, "config.json"), JSON.stringify({ macros }));
}

function pngWithDimensions(width, height) {
  return createPngFromScanlines(
    width,
    height,
    Buffer.alloc(height * (width + 1)),
    0,
  );
}

async function registeredImageApi(world, additional = {}) {
  const formula = freshApi();
  world.pi = fakePi();
  formula.registerFormula(world.pi.api, additional);
  await startWithKitty(world.pi);
  world.formula = formula;
}

Before(function () {
  resetFormulaState();
  this.originalEnvironment = {
    XDG_CONFIG_HOME: process.env.XDG_CONFIG_HOME,
    PI_FORMULA_MACROS: process.env.PI_FORMULA_MACROS,
  };
  this.xdg = mkdtempSync(join(tmpdir(), "pi-formula-cucumber-"));
  process.env.XDG_CONFIG_HOME = this.xdg;
  delete process.env.PI_FORMULA_MACROS;
});

After(function () {
  for (const [name, value] of Object.entries(this.originalEnvironment)) {
    if (value === undefined) delete process.env[name];
    else process.env[name] = value;
  }
  rmSync(this.xdg, { recursive: true, force: true });
});

Given("XDG 設定と環境変数に異なる利用者マクロがある", function () {
  writeConfig(this, { configured: "x" });
  process.env.PI_FORMULA_MACROS = JSON.stringify({ temporary: "y" });
});

When("両方の利用者マクロを使う PNG を公開 API で作る", async function () {
  await registeredImageApi(this);
  this.image = this.formula.createFormulaPng("\\configured+\\temporary", 80);
});

Then("XDG 設定と環境変数の利用者マクロが一緒に使える", function () {
  assert.equal(Buffer.isBuffer(this.image?.data), true);
});

Given("XDG 設定と環境変数に同名の利用者マクロがある", function () {
  writeConfig(this, { chosen: "y" });
  process.env.PI_FORMULA_MACROS = JSON.stringify({ chosen: "x" });
});

When("同名の利用者マクロを使う PNG を公開 API で作る", async function () {
  await registeredImageApi(this);
  this.image = this.formula.createFormulaPng("\\chosen", 80);
  this.expectedImage = this.formula.createFormulaPng("x", 80);
});

Then("環境変数の利用者マクロで PNG が作られる", function () {
  assert.deepEqual(this.image?.data, this.expectedImage?.data);
});

Given("空文字列の利用者マクロがある", function () {
  writeConfig(this, { empty: "" });
});

When("空文字列の利用者マクロを使う PNG を公開 API で作る", async function () {
  await registeredImageApi(this);
  this.image = this.formula.createFormulaPng("\\empty{}x", 80);
  this.expectedImage = this.formula.createFormulaPng("x", 80);
});

Then("空文字列の利用者マクロが使える", function () {
  assert.deepEqual(this.image?.data, this.expectedImage?.data);
});

Given("空文字列の追加マクロがある", async function () {
  await registeredImageApi(this, { empty: "" });
});

When("空文字列の追加マクロを使う PNG を公開 API で作る", function () {
  this.image = this.formula.createFormulaPng("\\empty{}x", 80);
  this.expectedImage = this.formula.createFormulaPng("x", 80);
});

Then("空文字列の追加マクロが使える", function () {
  assert.deepEqual(this.image?.data, this.expectedImage?.data);
});

Given("エスケープしたハッシュ記号の利用者マクロがある", function () {
  writeConfig(this, { hash: "\\#" });
});

When("その利用者マクロを使う PNG を公開 API で作る", async function () {
  await registeredImageApi(this);
  this.image = this.formula.createFormulaPng("\\hash", 80);
});

Then("ハッシュ記号の PNG が作られる", function () {
  assert.equal(Buffer.isBuffer(this.image?.data), true);
});

Given("正しい同名 XDG 定義と壊れた環境変数定義がある", function () {
  writeConfig(this, { chosen: "x" });
  process.env.PI_FORMULA_MACROS = JSON.stringify({ chosen: ["#2", 1] });
});

Then("正しい XDG 定義で PNG が作られる", function () {
  assert.deepEqual(this.image?.data, this.expectedImage?.data);
});

Given("正しい定義と壊れた定義を含む利用者マクロ設定がある", function () {
  writeConfig(this, { usable: "x", broken: ["#2", 1] });
});

When(
  "正しい利用者マクロと壊れた利用者マクロから PNG を作る",
  async function () {
    await registeredImageApi(this);
    this.usableImage = this.formula.createFormulaPng("\\usable", 80);
    this.brokenImage = this.formula.createFormulaPng("\\broken{x}", 80);
  },
);

Then("正しい利用者マクロだけが使える", function () {
  assert.deepEqual(
    {
      usable: Buffer.isBuffer(this.usableImage?.data),
      broken: this.brokenImage,
    },
    { usable: true, broken: undefined },
  );
});

Given("正しい XDG 設定と壊れた JSON の環境変数がある", function () {
  writeConfig(this, { configured: "x" });
  process.env.PI_FORMULA_MACROS = "{";
});

When("XDG 設定の利用者マクロを使う PNG を公開 API で作る", async function () {
  await registeredImageApi(this);
  this.image = this.formula.createFormulaPng("\\configured", 80);
});

Then("壊れた環境変数に関係なく XDG 設定の利用者マクロが使える", function () {
  assert.equal(Buffer.isBuffer(this.image?.data), true);
});

Given("試験用の連携拡張と同名の利用者マクロがある", function () {
  writeConfig(this, { trial: "wrong" });
});

When("連携拡張の追加マクロを使う PNG を公開 API で作る", async function () {
  this.pi = fakePi();
  this.integration = registerIntegrationExtension(this.pi.api);
  await startWithKitty(this.pi);
  this.formula = freshApi();
  this.image = this.integration.createPng("\\trial{x}");
  this.expectedImage = this.formula.createFormulaPng(
    "\\left|x\\right\\rangle",
    80,
  );
});

Then("利用者設定では追加マクロを上書きできない", function () {
  assert.deepEqual(this.image?.data, this.expectedImage?.data);
});

Given("Object prototype と同名の追加マクロがある", async function () {
  await registeredImageApi(this, { constructor: "x" });
});

When("その追加マクロを使う PNG を公開 API で作る", function () {
  this.image = this.formula.createFormulaPng("\\constructor", 80);
  this.expectedImage = this.formula.createFormulaPng("x", 80);
});

Then("Object prototype と同名の追加マクロが使える", function () {
  assert.deepEqual(this.image?.data, this.expectedImage?.data);
});

Given("pi-formula の CommonJS 公開 API がある", function () {
  this.formula = freshApi();
});

When("公開された名前を調べる", function () {
  this.publicNames = Object.keys(this.formula).sort();
});

Then("既存の公開 API と画像経路向け API が公開される", function () {
  assert.deepEqual(this.publicNames, [
    "createFormulaPng",
    "getFormulaPath",
    "registerFormula",
    "renderPng",
  ]);
});

Given("画像経路を使う試験用の連携拡張がある", async function () {
  this.pi = fakePi();
  this.integration = registerIntegrationExtension(this.pi.api);
  this.started = await startWithKitty(this.pi);
});

When("公開 API へ文字列以外の LaTeX を渡す", function () {
  this.invalidImages = [
    this.integration.createPng(null),
    this.integration.createPng({ latex: "x" }),
  ];
});

Then("公開 API は例外を出さず画像を返さない", function () {
  assert.deepEqual(this.invalidImages, [undefined, undefined]);
});

When("連携拡張が公開 API で PNG を作る", function () {
  this.image = this.integration.createPng("\\trial{x}");
});

Then("PNG データと大きさが画面部品なしで返る", function () {
  assert.deepEqual(
    {
      keys: Object.keys(this.image ?? {}).sort(),
      png: this.image?.data.subarray(1, 4).toString("ascii"),
      positiveSize:
        (this.image?.widthPx ?? 0) > 0 && (this.image?.heightPx ?? 0) > 0,
    },
    {
      keys: ["columns", "data", "heightPx", "rows", "widthPx"],
      png: "PNG",
      positiveSize: true,
    },
  );
});

When("返された PNG データを変更して同じ表示数式を再び描く", function () {
  const first = this.integration.createPng("x");
  first.data[0] = 0;
  this.imageAfterMutation = this.integration.createPng("x");
  this.markdownAfterMutation = this.pi.transformer()("$$x$$", {
    messageType: "assistant",
    isStreaming: false,
    availableWidth: 80,
  });
});

Then("次の公開 PNG と通常の表示数式は壊れない", function () {
  assert.deepEqual(
    {
      signature: this.imageAfterMutation.data.subarray(0, 4).toString("hex"),
      markdownHasPngSignature: this.markdownAfterMutation.includes("iVBOR"),
    },
    { signature: "89504e47", markdownHasPngSignature: true },
  );
});

When("テーマの文字色を変えて同じ表示数式の PNG を作る", function () {
  this.imageBeforeThemeChange = this.integration.createPng("x");
  this.started.setTextColor("\x1b[38;2;1;2;3m");
  this.imageAfterThemeChange = this.integration.createPng("x");
});

Then("変更後の文字色で新しい PNG が作られる", function () {
  assert.equal(
    this.imageBeforeThemeChange.data.equals(this.imageAfterThemeChange.data),
    false,
  );
});

Given("テキスト経路を使う試験用の連携拡張がある", async function () {
  this.pi = fakePi();
  this.integration = registerIntegrationExtension(this.pi.api);
  await startWithText(this.pi);
});

Then("公開 API は画像を返さない", function () {
  assert.equal(this.image, undefined);
});

When("現在の表示経路を公開 API で問い合わせる", function () {
  this.path = freshApi().getFormulaPath();
});

Then("現在の表示経路は画像経路である", function () {
  assert.equal(this.path, "image");
});

Then("現在の表示経路はテキスト経路である", function () {
  assert.equal(this.path, "text");
});

When("Buffer の既成 PNG を公開 API で描く", function () {
  this.renderedPng = freshApi().renderPng(pngWithDimensions(100, 50), 8);
});

Then("端末寸法に合わせた画像転送と配置が返る", function () {
  assert.deepEqual(
    {
      rendered: this.renderedPng.rendered,
      reason: this.renderedPng.reason,
      hasTransfer: this.renderedPng.output?.includes("\x1b_Ga=T,f=100"),
      hasPlaceholder: this.renderedPng.output?.includes(
        String.fromCodePoint(0x10eeee),
      ),
      withinWidth: this.renderedPng.columns <= 8,
      positiveRows: this.renderedPng.rows > 0,
    },
    {
      rendered: true,
      reason: undefined,
      hasTransfer: true,
      hasPlaceholder: true,
      withinWidth: true,
      positiveRows: true,
    },
  );
});

When("ファイルの既成 PNG を公開 API で描く", function () {
  const path = join(this.xdg, "existing.png");
  writeFileSync(path, pngWithDimensions(120, 60));
  this.renderedPng = freshApi().renderPng(path, 10);
});

Then("ファイルの画像転送と配置が返る", function () {
  assert.equal(
    this.renderedPng.rendered && this.renderedPng.output.includes("iVBOR"),
    true,
  );
});

Then("代替表示を選べる結果が返る", function () {
  assert.deepEqual(this.renderedPng, {
    rendered: false,
    reason: "image-unavailable",
  });
});

When("安全上限を超える既成 PNG を公開 API で描く", function () {
  this.renderedPng = freshApi().renderPng(pngWithDimensions(1, 100_000), 80);
});

Then("安全上限による拒否結果が返る", function () {
  assert.deepEqual(this.renderedPng, {
    rendered: false,
    reason: "safety-limit",
  });
});

When("途中で切れた既成 PNG を公開 API で描く", function () {
  const png = pngWithDimensions(10, 10);
  this.renderedPng = freshApi().renderPng(png.subarray(0, png.length - 5), 80);
});

Then("不正な PNG による拒否結果が返る", function () {
  assert.deepEqual(this.renderedPng, {
    rendered: false,
    reason: "invalid-png",
  });
});

When("展開上限を超える既成 PNG を公開 API で描く", function () {
  this.renderedPng = freshApi().renderPng(pngWithDimensions(3000, 2000), 80);
});

Given("利用者マクロを読む拡張 runtime がある", async function () {
  writeConfig(this, { original: "x" });
  this.firstRuntime = loadStandaloneExtension();
  this.firstPi = fakePi();
  this.firstRuntime.register(this.firstPi.api);
  this.firstStarted = await startWithKitty(this.firstPi);
});

When(
  "runtime を終了して別の利用者マクロを使う runtime を登録する",
  async function () {
    await this.firstPi.handlers.get("session_shutdown")(
      { reason: "reload" },
      this.firstStarted.ctx,
    );
    writeConfig(this, { reloaded: "x" });
    process.env.PI_FORMULA_MACROS = JSON.stringify({ temporary: "y" });
    this.secondRuntime = loadStandaloneExtension();
    this.secondPi = fakePi();
    this.secondRuntime.register(this.secondPi.api);
    await startWithKitty(this.secondPi);
    this.reloadedImage = this.secondRuntime.formula.createFormulaPng(
      "\\reloaded+\\temporary",
      80,
    );
  },
);

Then(
  "新しい runtime に描画と formula コマンドが一つずつ登録される",
  function () {
    assert.deepEqual(
      {
        ...this.secondPi.registrationCounts(),
        formulaCommand: this.secondPi.commands.has("formula"),
        reloadedMacro: Buffer.isBuffer(this.reloadedImage?.data),
      },
      {
        transformerRegistrations: 1,
        commandRegistrations: 1,
        formulaCommand: true,
        reloadedMacro: true,
      },
    );
  },
);

async function loadBoth(world, bundledFirst) {
  const first = bundledFirst
    ? loadIntegrationExtension()
    : loadStandaloneExtension();
  const second = bundledFirst
    ? loadStandaloneExtension()
    : loadIntegrationExtension();
  const bundled = bundledFirst ? first : second;
  const standalone = bundledFirst ? second : first;
  const shared = {};
  const standalonePi = fakePi({ shared });
  const bundledPi = fakePi({ shared });
  let integration;
  if (bundledFirst) {
    integration = bundled.register(bundledPi.api);
    standalone.register(standalonePi.api);
  } else {
    standalone.register(standalonePi.api);
    integration = bundled.register(bundledPi.api);
  }
  await startWithKitty(bundledFirst ? bundledPi : standalonePi);
  world.counts = standalonePi.registrationCounts();
  world.integrationImage = integration.createPng("\\trial{x}", 80);
  world.distinctApis = standalonePi.api !== bundledPi.api;
}

Given("単体版を同梱版より先に読み込む", async function () {
  await loadBoth(this, false);
});

Given("同梱版を単体版より先に読み込む", async function () {
  await loadBoth(this, true);
});

When("両方の拡張登録を調べる", function () {
  this.result = {
    ...this.counts,
    additionalMacro: Buffer.isBuffer(this.integrationImage?.data),
    distinctApis: this.distinctApis,
  };
});

Then("数式描画と formula コマンドは一つになる", function () {
  assert.deepEqual(this.result, {
    transformerRegistrations: 1,
    commandRegistrations: 1,
    additionalMacro: true,
    distinctApis: true,
  });
});
