const assert = require("node:assert/strict");
const { mkdirSync, mkdtempSync, rmSync, writeFileSync } = require("node:fs");
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

const { isolatedRenderer } = require("../support/isolated-renderer");

const apiPath = require.resolve("../..");

function finalSgrRendition(output) {
  const state = { background: null, dim: false };
  for (const match of output.matchAll(/\x1b\[([\d;]*)m/gu)) {
    const parameters = match[1].split(";").map(Number);
    for (let index = 0; index < parameters.length; index += 1) {
      const parameter = parameters[index];
      if (parameter === 38 || parameter === 48) index += 4;
      else if (parameter === 0) {
        state.background = null;
        state.dim = false;
      } else if (parameter === 2) state.dim = true;
      else if (
        (parameter >= 40 && parameter <= 47) ||
        (parameter >= 100 && parameter <= 107)
      ) {
        state.background = parameter;
      }
    }
  }
  return state;
}

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

When("両方の利用者マクロを使う PNG を公開 API で作る", async function () {
  this.image = this.formula.createFormulaPng("\\configured+\\temporary", 80);
});

Then("XDG 設定と環境変数の利用者マクロが一緒に使える", function () {
  assert.equal(Buffer.isBuffer(this.image?.data), true);
});

When("同名の利用者マクロを使う PNG を公開 API で作る", function () {
  this.image = this.formula.createFormulaPng("\\chosen", 80);
});

Then("環境変数の利用者マクロで PNG が作られる", function () {
  assert.deepEqual(this.image?.data, this.expectedImage?.data);
});

When("空文字列の利用者マクロを使う PNG を公開 API で作る", function () {
  this.image = this.formula.createFormulaPng("\\empty{}x", 80);
});

Then("空文字列の利用者マクロが使える", function () {
  assert.deepEqual(this.image?.data, this.expectedImage?.data);
});

Given("空文字列の追加マクロがある", async function () {
  await registeredImageApi(this, { empty: "" });
});

When("空文字列の追加マクロを使う PNG を公開 API で作る", function () {
  this.image = this.formula.createFormulaPng("\\empty{}x", 80);
});

Then("空文字列の追加マクロが使える", function () {
  assert.deepEqual(this.image?.data, this.expectedImage?.data);
});

When("その利用者マクロを使う PNG を公開 API で作る", async function () {
  this.image = this.formula.createFormulaPng("\\hash", 80);
});

Then("ハッシュ記号の PNG が作られる", function () {
  assert.equal(Buffer.isBuffer(this.image?.data), true);
});

Then("正しい XDG 定義で PNG が作られる", function () {
  assert.deepEqual(this.image?.data, this.expectedImage?.data);
});

When("正しい利用者マクロからPNGを作る", function () {
  this.usableImage = this.formula.createFormulaPng("\\usable", 80);
});

Then("正しい利用者マクロでPNGが作られる", function () {
  assert.deepEqual(Buffer.isBuffer(this.usableImage?.data), true);
});

Then("壊れた利用者マクロではPNGを返さない", function () {
  assert.deepEqual(this.brokenImage, undefined);
});

When("XDG 設定の利用者マクロを使う PNG を公開 API で作る", async function () {
  this.image = this.formula.createFormulaPng("\\configured", 80);
});

Then("壊れた環境変数に関係なく XDG 設定の利用者マクロが使える", function () {
  assert.equal(Buffer.isBuffer(this.image?.data), true);
});

When("連携拡張の追加マクロを使う PNG を公開 API で作る", function () {
  this.image = this.integration.createPng("\\trial{x}");
});

Then("利用者設定では追加マクロを上書きできない", function () {
  assert.deepEqual(this.image?.data, this.expectedImage?.data);
});

Given("Object prototype と同名の追加マクロがある", async function () {
  await registeredImageApi(this, { constructor: "x" });
});

When("その追加マクロを使う PNG を公開 API で作る", function () {
  this.image = this.formula.createFormulaPng("\\constructor", 80);
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

When("公開APIへ {word} のLaTeX入力を渡す", function (input) {
  const values = { null: null, object: { latex: "x" } };
  if (!Object.hasOwn(values, input))
    throw new Error(`unknown invalid input: ${input}`);
  this.invalidImage = this.integration.createPng(values[input]);
});

Then("公開 API は例外を出さず画像を返さない", function () {
  assert.equal(this.invalidImage, undefined);
});

When("連携拡張が公開 API で PNG を作る", function () {
  this.image = this.integration.createPng("\\trial{x}");
});

Then("公開PNGの返り値には画像データと寸法だけが含まれる", function () {
  assert.deepEqual(Object.keys(this.image ?? {}).sort(), [
    "columns",
    "data",
    "heightPx",
    "rows",
    "widthPx",
  ]);
});

Then("公開PNGのデータはPNG形式である", function () {
  assert.deepEqual(this.image?.data.subarray(1, 4).toString("ascii"), "PNG");
});

Then("公開PNGの幅は正数である", function () {
  assert.ok((this.image?.widthPx ?? 0) > 0);
});

When("変更前の公開PNGを作る", function () {
  this.mutableImage = this.integration.createPng("x");
});

Then("変更されたBufferから次の公開PNGへ破損が伝わらない", function () {
  assert.deepEqual(
    this.imageAfterMutation.data.subarray(0, 4).toString("hex"),
    "89504e47",
  );
});

Then("変更されたBufferからMarkdownの画像へ破損が伝わらない", function () {
  assert.deepEqual(this.markdownAfterMutation.includes("iVBOR"), true);
});

When("テーマ変更前の公開PNGを作る", function () {
  this.imageBeforeThemeChange = this.integration.createPng("x");
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

When("{string} を含む表示数式の PNG を公開 API で作る", function (latex) {
  this.image = this.integration.createPng(latex);
});

Then("動的字形を含む表示数式の PNG が返る", function () {
  assert.equal(Buffer.isBuffer(this.image?.data), true);
});

Then("既存の字形を含む表示数式の PNG が返る", function () {
  assert.equal(Buffer.isBuffer(this.image?.data), true);
});

When("動的字形を含む表示数式の PNG を公開 API で作る", function () {
  this.image = this.integration.createPng("\\mathcal{L}");
});

Then("公開 API は同期的に PNG を返す", function () {
  assert.equal(Object.prototype.toString.call(this.image), "[object Object]");
});

Given("動的字形を読み込めない画像経路がある", async function () {
  this.isolatedRenderer = isolatedRenderer({ blockDynamicFont: true });
  await this.isolatedRenderer.request("load");
  await this.isolatedRenderer.request("register");
  await this.isolatedRenderer.request("start");
  this.dynamicFontResult = {};
});

When("動的字形を含む表示数式を描く", async function () {
  const result = await this.isolatedRenderer.request("render", {
    markdown: "$$\\mathcal{L}$$",
  });
  this.dynamicFontResult.dynamic = result.markdown;
});

Then("動的字形を読み込めない表示数式は原文へ戻る", function () {
  assert.deepEqual(this.dynamicFontResult.dynamic, "$$\\mathcal{L}$$");
});

Then("動的字形を使わない表示数式は引き続き画像になる", function () {
  assert.deepEqual(this.dynamicFontResult.ordinaryImage, true);
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

Given("危険域のバイトを含む画像 ID になる既成 PNG がある", async function () {
  await registeredImageApi(this);
  this.dangerousIdPng = createPngFromScanlines(
    1,
    1,
    Buffer.from([0, 7, 0, 0, 255]),
  );
});

When("Buffer の既成 PNG を公開 API で描く", function () {
  const png = this.dangerousIdPng ?? pngWithDimensions(100, 50);
  this.renderedPng = freshApi().renderPng(png, 8);
});

Then("既成PNGの描画は成功する", function () {
  assert.deepEqual(this.renderedPng.rendered, true);
});

Then("既成PNGの描画成功時に拒否理由はない", function () {
  assert.deepEqual(this.renderedPng.reason, undefined);
});

Then("既成PNGの描画結果には画像転送が含まれる", function () {
  assert.deepEqual(this.renderedPng.output?.includes("\x1b_Ga=T,f=100"), true);
});

Then("既成PNGの描画結果にはplaceholderが含まれる", function () {
  assert.deepEqual(
    this.renderedPng.output?.includes(String.fromCodePoint(0x10eeee)),
    true,
  );
});

Then("既成PNGの配置は8列以内に収まる", function () {
  assert.deepEqual(this.renderedPng.columns <= 8, true);
});

Then("既成PNGの配置は1行以上を使う", function () {
  assert.deepEqual(this.renderedPng.rows > 0, true);
});

Then("既成PNGの画像IDは危険域の3バイトを保持する", function () {
  const output = this.renderedPng.output ?? "";
  const id = Number(/(?:^|,)i=(\d+)(?:,|$)/u.exec(output)?.[1]);
  assert.deepEqual(
    [(id >> 16) & 0xff, (id >> 8) & 0xff, id & 0xff],
    [216, 242, 43],
  );
});

Then("placeholderの下線色はコロン形式で表現される", function () {
  const output = this.renderedPng.output ?? "";
  assert.deepEqual(/\x1b\[58:2::216:242:43m/u.test(output), true);
});

Then("placeholder出力後に背景色は残らない", function () {
  assert.equal(this.placeholderRendition.background, null);
});

Then("placeholder出力後にdimは残らない", function () {
  assert.equal(this.placeholderRendition.dim, false);
});

When("ファイルの既成 PNG を公開 API で描く", function () {
  const path = join(this.xdg, "existing.png");
  writeFileSync(path, pngWithDimensions(120, 60));
  this.renderedPng = freshApi().renderPng(path, 10);
});

Then("ファイルの既成PNGは描画される", function () {
  assert.equal(this.renderedPng.rendered, true);
});

Then("画像を使えない端末では既成PNGを描画しない", function () {
  assert.deepEqual(this.renderedPng.rendered, false);
});

Then("既成PNGを描画しない理由は画像経路を使えないことである", function () {
  assert.deepEqual(this.renderedPng.reason, "image-unavailable");
});

When("安全上限を超える既成 PNG を公開 API で描く", function () {
  this.renderedPng = freshApi().renderPng(pngWithDimensions(1, 100_000), 80);
});

Then("安全上限を超えた既成PNGは描画しない", function () {
  assert.deepEqual(this.renderedPng.rendered, false);
});

Then("既成PNGの拒否理由は安全上限である", function () {
  assert.deepEqual(this.renderedPng.reason, "safety-limit");
});

When("途中で切れた既成 PNG を公開 API で描く", function () {
  const png = pngWithDimensions(10, 10);
  this.renderedPng = freshApi().renderPng(png.subarray(0, png.length - 5), 80);
});

Then("不正な既成PNGは描画しない", function () {
  assert.deepEqual(this.renderedPng.rendered, false);
});

Then("既成PNGの拒否理由はPNG形式の不正である", function () {
  assert.deepEqual(this.renderedPng.reason, "invalid-png");
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

When("元のruntimeのセッションを終了する", async function () {
  await this.firstPi.handlers.get("session_shutdown")(
    { reason: "reload" },
    this.firstStarted.ctx,
  );
});

Then("再登録したruntimeのMarkdown描画は1個だけ登録される", function () {
  assert.deepEqual(
    this.secondPi.registrationCounts().transformerRegistrations,
    1,
  );
});

Then("再登録したruntimeのコマンドは1個だけ登録される", function () {
  assert.deepEqual(this.secondPi.registrationCounts().commandRegistrations, 1);
});

Then("再登録したruntimeでformulaコマンドを利用できる", function () {
  assert.deepEqual(this.secondPi.commands.has("formula"), true);
});

Then("再登録したruntimeで新しい利用者マクロを使える", function () {
  assert.deepEqual(Buffer.isBuffer(this.reloadedImage?.data), true);
});

Given("単体版を同梱版より先に読み込む順序である", function () {
  this.extensionOrder = "standalone";
  const shared = {};
  this.standalonePi = fakePi({ shared });
  this.bundledPi = fakePi({ shared });
});

Given("同梱版を単体版より先に読み込む順序である", function () {
  this.extensionOrder = "bundled";
  const shared = {};
  this.standalonePi = fakePi({ shared });
  this.bundledPi = fakePi({ shared });
});

When("両方の拡張登録を調べる", function () {
  this.result = {
    ...this.standalonePi.registrationCounts(),
    additionalMacro: Buffer.isBuffer(this.integrationImage?.data),
    distinctApis: this.standalonePi.api !== this.bundledPi.api,
  };
});

Then("単体版と同梱版のMarkdown描画は1個だけ登録される", function () {
  assert.deepEqual(this.result.transformerRegistrations, 1);
});

Then("単体版と同梱版のコマンドは1個だけ登録される", function () {
  assert.deepEqual(this.result.commandRegistrations, 1);
});

Then("単体版と同梱版を読み込んでも連携拡張の追加マクロを使える", function () {
  assert.deepEqual(this.result.additionalMacro, true);
});

Then("単体版と同梱版は異なるPi APIで登録されている", function () {
  assert.deepEqual(this.result.distinctApis, true);
});

Given("XDG設定の利用者マクロは次のとおりである", function (table) {
  const macros = Object.fromEntries(
    table.rows().map(([name, replacement, arity]) => {
      if (arity !== "なし" && !/^\d+$/u.test(arity))
        throw new Error(`Unknown macro arity: ${arity}`);
      return [
        name,
        arity === "なし" ? replacement : [replacement, Number(arity)],
      ];
    }),
  );
  writeConfig(this, macros);
});

Given("環境変数の利用者マクロは次のとおりである", (table) => {
  const macros = Object.fromEntries(
    table.rows().map(([name, replacement, arity]) => {
      if (arity !== "なし" && !/^\d+$/u.test(arity))
        throw new Error(`Unknown macro arity: ${arity}`);
      return [
        name,
        arity === "なし" ? replacement : [replacement, Number(arity)],
      ];
    }),
  );
  process.env.PI_FORMULA_MACROS = JSON.stringify(macros);
});

Given("環境変数のマクロ設定は壊れたJSONである", () => {
  process.env.PI_FORMULA_MACROS = "{";
});

Given("画像経路の公開APIを使っている", async function () {
  await registeredImageApi(this);
});

When("比較用の数式 {string} のPNGを公開APIで作る", function (latex) {
  this.expectedImage = freshApi().createFormulaPng(latex, 80);
});

When("壊れた利用者マクロからPNGを作る", function () {
  this.brokenImage = this.formula.createFormulaPng("\\broken{x}", 80);
});

When("返された公開PNGのBufferを書き換える", function () {
  this.mutableImage.data[0] = 0;
});

When("同じ数式の公開PNGをもう一度作る", function () {
  this.imageAfterMutation = this.integration.createPng("x");
});

When("同じ数式をMarkdownの表示数式として描く", function () {
  this.markdownAfterMutation = this.pi.transformer()("$$x$$", {
    messageType: "assistant",
    isStreaming: false,
    availableWidth: 80,
  });
});

When("テーマの文字色をRGBの1・2・3へ変える", function () {
  this.started.setTextColor("\x1b[38;2;1;2;3m");
});

When("テーマ変更後の同じ数式の公開PNGを作る", function () {
  this.imageAfterThemeChange = this.integration.createPng("x");
});

When("XDGの利用者マクロを再読込用の定義へ変更する", function () {
  writeConfig(this, { reloaded: "x" });
});

When("環境変数の利用者マクロを再読込用の定義へ変更する", () => {
  process.env.PI_FORMULA_MACROS = JSON.stringify({ temporary: "y" });
});

When("別のruntimeを読み込んで登録する", function () {
  this.secondRuntime = loadStandaloneExtension();
  this.secondPi = fakePi();
  this.secondRuntime.register(this.secondPi.api);
});

When("新しいruntimeで画像経路のセッションを開始する", async function () {
  await startWithKitty(this.secondPi);
});

When("新しいruntimeの利用者マクロでPNGを作る", function () {
  this.reloadedImage = this.secondRuntime.formula.createFormulaPng(
    "\\reloaded+\\temporary",
    80,
  );
});

When("比較用の数式のPNGを公開APIで作る", function (latex) {
  this.expectedImage = freshApi().createFormulaPng(latex, 80);
});

Then("公開PNGの高さは正数である", function () {
  assert.ok((this.image?.heightPx ?? 0) > 0);
});

When("同じruntimeで動的字形を使わない表示数式を描く", async function () {
  const result = await this.isolatedRenderer.request("render", {
    markdown: "$$x$$",
  });
  this.dynamicFontResult.ordinaryImage =
    result.markdown.includes("\x1b_Ga=T,f=100");
});

When("順序で最初の拡張を読み込む", function () {
  if (this.extensionOrder === "bundled")
    this.bundled = loadIntegrationExtension();
  else this.standalone = loadStandaloneExtension();
});

When("順序で次の拡張を読み込む", function () {
  if (this.extensionOrder === "bundled")
    this.standalone = loadStandaloneExtension();
  else this.bundled = loadIntegrationExtension();
});

When("順序で最初の拡張を登録する", function () {
  if (this.extensionOrder === "bundled")
    this.integration = this.bundled.register(this.bundledPi.api);
  else this.standalone.register(this.standalonePi.api);
});

When("順序で次の拡張を登録する", function () {
  if (this.extensionOrder === "bundled")
    this.standalone.register(this.standalonePi.api);
  else this.integration = this.bundled.register(this.bundledPi.api);
});

When("最初に登録したPiで画像経路のセッションを開始する", async function () {
  await startWithKitty(
    this.extensionOrder === "bundled" ? this.bundledPi : this.standalonePi,
  );
});

When("両方を登録したruntimeで連携拡張のPNGを作る", function () {
  this.integrationImage = this.integration.createPng("\\trial{x}", 80);
});

Then("ファイルの既成PNGはPNG画像を転送する", function () {
  assert.equal(this.renderedPng.output?.includes("iVBOR"), true);
});

Then("拒否結果には描画状態と拒否理由だけがある", function () {
  assert.deepEqual(Object.keys(this.renderedPng).sort(), [
    "reason",
    "rendered",
  ]);
});

After(async function () {
  if (this.isolatedRenderer) await this.isolatedRenderer.close();
});

When("placeholder出力後のSGR状態を読み取る", function () {
  this.placeholderRendition = finalSgrRendition(this.renderedPng.output ?? "");
});
