import type { RendererModule } from "../support/isolated-renderer.js";

interface StepWorld {
  brokenImage: ReturnType<StepWorld["formula"]["createFormulaPng"]>;
  bundled: ReturnType<typeof loadIntegrationExtension>;
  bundledPi: ReturnType<typeof fakePi>;
  dangerousIdPng: Buffer;
  dynamicFontResult: { dynamic?: string; ordinaryImage?: boolean };
  expectedImage: ReturnType<StepWorld["formula"]["createFormulaPng"]>;
  extensionOrder: "standalone" | "bundled";
  firstPi: ReturnType<typeof fakePi>;
  firstRuntime: ReturnType<typeof loadStandaloneExtension>;
  firstStarted: Awaited<ReturnType<typeof startWithKitty>>;
  formula: typeof import("../../dist/api.js");
  image: ReturnType<StepWorld["formula"]["createFormulaPng"]>;
  imageAfterMutation: ReturnType<StepWorld["formula"]["createFormulaPng"]>;
  imageAfterThemeChange: ReturnType<StepWorld["formula"]["createFormulaPng"]>;
  imageBeforeThemeChange: ReturnType<StepWorld["formula"]["createFormulaPng"]>;
  integration: ReturnType<typeof registerIntegrationExtension>;
  integrationImage: ReturnType<StepWorld["formula"]["createFormulaPng"]>;
  invalidImage: ReturnType<StepWorld["formula"]["createFormulaPng"]>;
  isolatedRenderer: ReturnType<typeof isolatedRenderer>;
  markdownAfterMutation: string;
  mutableImage: ReturnType<StepWorld["formula"]["createFormulaPng"]>;
  originalEnvironment: Record<string, string | undefined>;
  path: ReturnType<StepWorld["formula"]["getFormulaPath"]>;
  pi: ReturnType<typeof fakePi>;
  placeholderRendition: ReturnType<typeof finalSgrRendition>;
  publicNames: string[];
  reloadedImage: ReturnType<StepWorld["formula"]["createFormulaPng"]>;
  renderedPng: ReturnType<StepWorld["formula"]["renderPng"]>;
  result: ReturnType<ReturnType<typeof fakePi>["registrationCounts"]> & {
    additionalMacro: boolean;
    distinctApis: boolean;
  };
  secondPi: ReturnType<typeof fakePi>;
  secondRuntime: ReturnType<typeof loadStandaloneExtension>;
  standalone: ReturnType<typeof loadStandaloneExtension>;
  standalonePi: ReturnType<typeof fakePi>;
  started: Awaited<ReturnType<typeof startWithKitty>>;
  usableImage: ReturnType<StepWorld["formula"]["createFormulaPng"]>;
  xdg: string;
}

const assert: typeof import("node:assert/strict") = require("node:assert/strict");
const {
  mkdirSync,
  mkdtempSync,
  rmSync,
  writeFileSync,
}: typeof import("node:fs") = require("node:fs");
const { tmpdir }: typeof import("node:os") = require("node:os");
const { join }: typeof import("node:path") = require("node:path");
const {
  After,
  Before,
  Given,
  Then,
  When,
}: typeof import("@cucumber/cucumber") = require("@cucumber/cucumber");

const {
  createPngFromScanlines,
}: typeof import("../../test/support/png-fixture.js") = require("../../test/support/png-fixture.js");
const {
  fakePi,
  resetFormulaState,
  startWithKitty,
  startWithText,
}: typeof import("../../test/support/fake-pi") = require("../../test/support/fake-pi");
const {
  loadIntegrationExtension,
  registerIntegrationExtension,
}: typeof import("../../test/support/integration-extension") = require("../../test/support/integration-extension");
const {
  loadStandaloneExtension,
}: typeof import("../../test/support/standalone-extension") = require("../../test/support/standalone-extension");

const {
  isolatedRenderer,
}: RendererModule = require("../support/isolated-renderer.js");

const apiPath = require.resolve("../..");

function finalSgrRendition(output: string) {
  const state: { background: number | null; dim: boolean } = {
    background: null,
    dim: false,
  };
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

function unexpectedReason(result: StepWorld["renderedPng"]): unknown {
  return "reason" in result ? result.reason : undefined;
}

function freshApi(): typeof import("../../dist/api.js") {
  delete require.cache[apiPath];
  return require(apiPath);
}

function writeConfig(
  world: StepWorld,
  macros: import("../../dist/macros.js").FormulaMacros,
) {
  const directory = join(world.xdg, "pi-formula");
  mkdirSync(directory, { recursive: true });
  writeFileSync(join(directory, "config.json"), JSON.stringify({ macros }));
}

function pngWithDimensions(width: number, height: number) {
  return createPngFromScanlines(
    width,
    height,
    Buffer.alloc(height * (width + 1)),
    0,
  );
}

async function registeredImageApi(
  world: StepWorld,
  additional: import("../../dist/macros.js").FormulaMacros = {},
) {
  const formula = freshApi();
  world.pi = fakePi();
  formula.registerFormula(world.pi.api, additional);
  await startWithKitty(world.pi);
  world.formula = formula;
}

Before(function (this: StepWorld) {
  resetFormulaState();
  this.originalEnvironment = {
    XDG_CONFIG_HOME: process.env.XDG_CONFIG_HOME,
    PI_FORMULA_MACROS: process.env.PI_FORMULA_MACROS,
  };
  this.xdg = mkdtempSync(join(tmpdir(), "pi-formula-cucumber-"));
  process.env.XDG_CONFIG_HOME = this.xdg;
  delete process.env.PI_FORMULA_MACROS;
});

After(function (this: StepWorld) {
  for (const [name, value] of Object.entries(this.originalEnvironment)) {
    if (value === undefined) delete process.env[name];
    else process.env[name] = value;
  }
  rmSync(this.xdg, { recursive: true, force: true });
});

When(
  "create a PNG using both user macros through the public API",
  async function (this: StepWorld) {
    this.image = this.formula.createFormulaPng("\\configured+\\temporary", 80);
  },
);

Then(
  "User macros from XDG settings and environment variables can be used together",
  function (this: StepWorld) {
    assert.equal(Buffer.isBuffer(this.image?.data), true);
  },
);

When(
  "create a PNG using the user macro of the same name through the public API",
  function (this: StepWorld) {
    this.image = this.formula.createFormulaPng("\\chosen", 80);
  },
);

Then(
  "A PNG is created with the environment variable user macro",
  function (this: StepWorld) {
    assert.deepEqual(this.image?.data, this.expectedImage?.data);
  },
);

When(
  "create a PNG using an empty-string user macro through the public API",
  function (this: StepWorld) {
    this.image = this.formula.createFormulaPng("\\empty{}x", 80);
  },
);

Then("An empty-string user macro can be used", function (this: StepWorld) {
  assert.deepEqual(this.image?.data, this.expectedImage?.data);
});

Given("an empty-string extra macro exists", async function (this: StepWorld) {
  await registeredImageApi(this, { empty: "" });
});

When(
  "create a PNG using an empty-string extra macro through the public API",
  function (this: StepWorld) {
    this.image = this.formula.createFormulaPng("\\empty{}x", 80);
  },
);

Then("An empty-string extra macro can be used", function (this: StepWorld) {
  assert.deepEqual(this.image?.data, this.expectedImage?.data);
});

When(
  "create a PNG using that user macro through the public API",
  async function (this: StepWorld) {
    this.image = this.formula.createFormulaPng("\\hash", 80);
  },
);

Then("A PNG of the hash sign is created", function (this: StepWorld) {
  assert.equal(Buffer.isBuffer(this.image?.data), true);
});

Then("A PNG is created with valid XDG definitions", function (this: StepWorld) {
  assert.deepEqual(this.image?.data, this.expectedImage?.data);
});

When("create a PNG from a valid user macro", function (this: StepWorld) {
  this.usableImage = this.formula.createFormulaPng("\\usable", 80);
});

Then("A valid user macro produces a PNG", function (this: StepWorld) {
  assert.deepEqual(Buffer.isBuffer(this.usableImage?.data), true);
});

Then("An invalid user macro returns no PNG", function (this: StepWorld) {
  assert.deepEqual(this.brokenImage, undefined);
});

When(
  "create a PNG using the XDG user macro through the public API",
  async function (this: StepWorld) {
    this.image = this.formula.createFormulaPng("\\configured", 80);
  },
);

Then(
  "XDG user macros remain available despite an invalid environment variable",
  function (this: StepWorld) {
    assert.equal(Buffer.isBuffer(this.image?.data), true);
  },
);

When(
  "create a PNG using integration extension extra macros through the public API",
  function (this: StepWorld) {
    this.image = this.integration.createPng("\\trial{x}");
  },
);

Then("User settings cannot override extra macros", function (this: StepWorld) {
  assert.deepEqual(this.image?.data, this.expectedImage?.data);
});

Given(
  "an extra macro has the same name as an Object prototype member",
  async function (this: StepWorld) {
    await registeredImageApi(this, { constructor: "x" });
  },
);

When(
  "create a PNG using that extra macro through the public API",
  function (this: StepWorld) {
    this.image = this.formula.createFormulaPng("\\constructor", 80);
  },
);

Then(
  "An extra macro named after an Object prototype member can be used",
  function (this: StepWorld) {
    assert.deepEqual(this.image?.data, this.expectedImage?.data);
  },
);

Given("the pi-formula CommonJS public API exists", function (this: StepWorld) {
  this.formula = freshApi();
});

When("inspect the exported names", function (this: StepWorld) {
  this.publicNames = Object.keys(this.formula).sort();
});

Then(
  "The existing public API and image path API are exported",
  function (this: StepWorld) {
    assert.deepEqual(this.publicNames, [
      "createFormulaPng",
      "getFormulaPath",
      "registerFormula",
      "renderPng",
    ]);
  },
);

Given(
  "a test integration extension uses the image path",
  async function (this: StepWorld) {
    this.pi = fakePi();
    this.integration = registerIntegrationExtension(this.pi.api);
    this.started = await startWithKitty(this.pi);
  },
);

When(
  "pass {word} LaTeX input to the public API",
  function (this: StepWorld, input: string) {
    const values: Record<string, unknown> = {
      null: null,
      object: { latex: "x" },
    };
    if (!Object.hasOwn(values, input))
      throw new Error(`unknown invalid input: ${input}`);
    this.invalidImage = Reflect.apply(
      this.integration.createPng,
      this.integration,
      [values[input]],
    );
  },
);

Then(
  "The public API returns no image without throwing",
  function (this: StepWorld) {
    assert.equal(this.invalidImage, undefined);
  },
);

When(
  "The integration extension creates a PNG through the public API",
  function (this: StepWorld) {
    this.image = this.integration.createPng("\\trial{x}");
  },
);

Then(
  "The public PNG result contains only image data and dimensions",
  function (this: StepWorld) {
    assert.deepEqual(Object.keys(this.image ?? {}).sort(), [
      "columns",
      "data",
      "heightPx",
      "rows",
      "widthPx",
    ]);
  },
);

Then("The public PNG data is in PNG format", function (this: StepWorld) {
  assert.deepEqual(this.image?.data.subarray(1, 4).toString("ascii"), "PNG");
});

Then("The public PNG width is positive", function (this: StepWorld) {
  assert.ok((this.image?.widthPx ?? 0) > 0);
});

When("create a public PNG before mutation", function (this: StepWorld) {
  this.mutableImage = this.integration.createPng("x");
});

Then(
  "A mutated Buffer does not corrupt the next public PNG",
  function (this: StepWorld) {
    assert.deepEqual(
      this.imageAfterMutation?.data.subarray(0, 4).toString("hex"),
      "89504e47",
    );
  },
);

Then(
  "A mutated Buffer does not corrupt the Markdown image",
  function (this: StepWorld) {
    assert.deepEqual(this.markdownAfterMutation.includes("iVBOR"), true);
  },
);

When("create a public PNG before the theme change", function (this: StepWorld) {
  this.imageBeforeThemeChange = this.integration.createPng("x");
});

Then(
  "A new PNG is created with the changed text color",
  function (this: StepWorld) {
    assert.equal(
      this.imageBeforeThemeChange && this.imageAfterThemeChange
        ? this.imageBeforeThemeChange.data.equals(
            this.imageAfterThemeChange.data,
          )
        : undefined,
      false,
    );
  },
);

Given(
  "a test integration extension uses the text path",
  async function (this: StepWorld) {
    this.pi = fakePi();
    this.integration = registerIntegrationExtension(this.pi.api);
    await startWithText(this.pi);
  },
);

When(
  "create a PNG of display math containing {string} through the public API",
  function (this: StepWorld, latex: string) {
    this.image = this.integration.createPng(latex);
  },
);

Then(
  "A PNG of display math containing dynamic glyphs is returned",
  function (this: StepWorld) {
    assert.equal(Buffer.isBuffer(this.image?.data), true);
  },
);

Then(
  "A PNG of display math containing existing glyphs is returned",
  function (this: StepWorld) {
    assert.equal(Buffer.isBuffer(this.image?.data), true);
  },
);

When(
  "create a PNG of display math containing dynamic glyphs through the public API",
  function (this: StepWorld) {
    this.image = this.integration.createPng("\\mathcal{L}");
  },
);

Then("The public API returns a PNG synchronously", function (this: StepWorld) {
  assert.equal(Object.prototype.toString.call(this.image), "[object Object]");
});

Given(
  "an image path with unavailable dynamic glyphs",
  async function (this: StepWorld) {
    this.isolatedRenderer = isolatedRenderer({ blockDynamicFont: true });
    await this.isolatedRenderer.request("load");
    await this.isolatedRenderer.request("register");
    await this.isolatedRenderer.request("start");
    this.dynamicFontResult = {};
  },
);

When(
  "render display math containing dynamic glyphs",
  async function (this: StepWorld) {
    const result = await this.isolatedRenderer.request("render", {
      markdown: "$$\\mathcal{L}$$",
    });
    this.dynamicFontResult.dynamic = result.markdown;
  },
);

Then(
  "Display math with unavailable dynamic glyphs falls back to its source",
  function (this: StepWorld) {
    assert.deepEqual(this.dynamicFontResult.dynamic, "$$\\mathcal{L}$$");
  },
);

Then(
  "Display math without dynamic glyphs still becomes an image",
  function (this: StepWorld) {
    assert.deepEqual(this.dynamicFontResult.ordinaryImage, true);
  },
);

Then("The public API returns no image", function (this: StepWorld) {
  assert.equal(this.image, undefined);
});

When(
  "query the current display path through the public API",
  function (this: StepWorld) {
    this.path = freshApi().getFormulaPath();
  },
);

Then("The current display path is the image path", function (this: StepWorld) {
  assert.equal(this.path, "image");
});

Then("The current display path is the text path", function (this: StepWorld) {
  assert.equal(this.path, "text");
});

Given(
  "a prebuilt PNG produces an image ID containing bytes in the unsafe range",
  async function (this: StepWorld) {
    await registeredImageApi(this);
    this.dangerousIdPng = createPngFromScanlines(
      1,
      1,
      Buffer.from([0, 7, 0, 0, 255]),
    );
  },
);

When(
  "render a prebuilt PNG Buffer through the public API",
  function (this: StepWorld) {
    const png = this.dangerousIdPng ?? pngWithDimensions(100, 50);
    this.renderedPng = freshApi().renderPng(png, 8);
  },
);

Then("Rendering the prebuilt PNG succeeds", function (this: StepWorld) {
  assert.deepEqual(this.renderedPng.rendered, true);
});

Then(
  "Successful prebuilt PNG rendering has no rejection reason",
  function (this: StepWorld) {
    assert.deepEqual(unexpectedReason(this.renderedPng), undefined);
  },
);

Then(
  "The prebuilt PNG render result contains an image transfer",
  function (this: StepWorld) {
    assert.deepEqual(
      (this.renderedPng.rendered
        ? this.renderedPng.output
        : undefined
      )?.includes("\x1b_Ga=T,f=100"),
      true,
    );
  },
);

Then(
  "The prebuilt PNG render result contains placeholders",
  function (this: StepWorld) {
    assert.deepEqual(
      (this.renderedPng.rendered
        ? this.renderedPng.output
        : undefined
      )?.includes(String.fromCodePoint(0x10eeee)),
      true,
    );
  },
);

Then(
  "The prebuilt PNG placement fits within 8 columns",
  function (this: StepWorld) {
    assert.deepEqual(
      this.renderedPng.rendered ? this.renderedPng.columns <= 8 : false,
      true,
    );
  },
);

Then(
  "The prebuilt PNG placement uses at least one row",
  function (this: StepWorld) {
    assert.deepEqual(
      this.renderedPng.rendered ? this.renderedPng.rows > 0 : false,
      true,
    );
  },
);

Then(
  "The prebuilt PNG image ID preserves the 3 bytes in the unsafe range",
  function (this: StepWorld) {
    const output =
      (this.renderedPng.rendered ? this.renderedPng.output : undefined) ?? "";
    const id = Number(/(?:^|,)i=(\d+)(?:,|$)/u.exec(output)?.[1]);
    assert.deepEqual(
      [(id >> 16) & 0xff, (id >> 8) & 0xff, id & 0xff],
      [216, 242, 43],
    );
  },
);

Then(
  "Placeholder underline colors use colon syntax",
  function (this: StepWorld) {
    const output =
      (this.renderedPng.rendered ? this.renderedPng.output : undefined) ?? "";
    assert.deepEqual(/\x1b\[58:2::216:242:43m/u.test(output), true);
  },
);

Then(
  "Background color does not remain after placeholder output",
  function (this: StepWorld) {
    assert.equal(this.placeholderRendition.background, null);
  },
);

Then(
  "Dim does not remain after placeholder output",
  function (this: StepWorld) {
    assert.equal(this.placeholderRendition.dim, false);
  },
);

When(
  "render a prebuilt PNG file through the public API",
  function (this: StepWorld) {
    const path = join(this.xdg, "existing.png");
    writeFileSync(path, pngWithDimensions(120, 60));
    this.renderedPng = freshApi().renderPng(path, 10);
  },
);

Then("The prebuilt PNG file is rendered", function (this: StepWorld) {
  assert.equal(this.renderedPng.rendered, true);
});

Then(
  "Do not render prebuilt PNGs in terminals without image support",
  function (this: StepWorld) {
    assert.deepEqual(this.renderedPng.rendered, false);
  },
);

Then(
  "The prebuilt PNG is not rendered because the image path is unavailable",
  function (this: StepWorld) {
    assert.deepEqual(unexpectedReason(this.renderedPng), "image-unavailable");
  },
);

When(
  "render a prebuilt PNG exceeding safety limits through the public API",
  function (this: StepWorld) {
    this.renderedPng = freshApi().renderPng(pngWithDimensions(1, 100_000), 80);
  },
);

Then(
  "A prebuilt PNG exceeding safety limits is not rendered",
  function (this: StepWorld) {
    assert.deepEqual(this.renderedPng.rendered, false);
  },
);

Then(
  "The prebuilt PNG rejection reason is the safety limit",
  function (this: StepWorld) {
    assert.deepEqual(unexpectedReason(this.renderedPng), "safety-limit");
  },
);

When(
  "render a truncated prebuilt PNG through the public API",
  function (this: StepWorld) {
    const png = pngWithDimensions(10, 10);
    this.renderedPng = freshApi().renderPng(
      png.subarray(0, png.length - 5),
      80,
    );
  },
);

Then("An invalid prebuilt PNG is not rendered", function (this: StepWorld) {
  assert.deepEqual(this.renderedPng.rendered, false);
});

Then(
  "The prebuilt PNG rejection reason is invalid PNG format",
  function (this: StepWorld) {
    assert.deepEqual(unexpectedReason(this.renderedPng), "invalid-png");
  },
);

When(
  "render a prebuilt PNG exceeding decompression limits through the public API",
  function (this: StepWorld) {
    this.renderedPng = freshApi().renderPng(pngWithDimensions(3000, 2000), 80);
  },
);

Given(
  "an extension runtime reads user macros",
  async function (this: StepWorld) {
    writeConfig(this, { original: "x" });
    this.firstRuntime = loadStandaloneExtension();
    this.firstPi = fakePi();
    this.firstRuntime.register(this.firstPi.api);
    this.firstStarted = await startWithKitty(this.firstPi);
  },
);

When("end the original runtime session", async function (this: StepWorld) {
  await this.firstPi.handlers.get("session_shutdown")(
    { reason: "reload" },
    this.firstStarted.ctx,
  );
});

Then(
  "The reregistered runtime has only one Markdown renderer registered",
  function (this: StepWorld) {
    assert.deepEqual(
      this.secondPi.registrationCounts().transformerRegistrations,
      1,
    );
  },
);

Then(
  "The reregistered runtime has only one command registered",
  function (this: StepWorld) {
    assert.deepEqual(
      this.secondPi.registrationCounts().commandRegistrations,
      1,
    );
  },
);

Then(
  "The formula command is available in the reregistered runtime",
  function (this: StepWorld) {
    assert.deepEqual(this.secondPi.commands.has("formula"), true);
  },
);

Then(
  "New user macros are available in the reregistered runtime",
  function (this: StepWorld) {
    assert.deepEqual(Buffer.isBuffer(this.reloadedImage?.data), true);
  },
);

Given(
  "the load order puts the standalone version before the bundled version",
  function (this: StepWorld) {
    this.extensionOrder = "standalone";
    const shared = {};
    this.standalonePi = fakePi({ shared });
    this.bundledPi = fakePi({ shared });
  },
);

Given(
  "the load order puts the bundled version before the standalone version",
  function (this: StepWorld) {
    this.extensionOrder = "bundled";
    const shared = {};
    this.standalonePi = fakePi({ shared });
    this.bundledPi = fakePi({ shared });
  },
);

When("inspect both extension registrations", function (this: StepWorld) {
  this.result = {
    ...this.standalonePi.registrationCounts(),
    additionalMacro: Buffer.isBuffer(this.integrationImage?.data),
    distinctApis: this.standalonePi.api !== this.bundledPi.api,
  };
});

Then(
  "The standalone and bundled versions register only one Markdown renderer",
  function (this: StepWorld) {
    assert.deepEqual(this.result.transformerRegistrations, 1);
  },
);

Then(
  "The standalone and bundled versions register only one command",
  function (this: StepWorld) {
    assert.deepEqual(this.result.commandRegistrations, 1);
  },
);

Then(
  "Integration extension extra macros remain available with both standalone and bundled versions loaded",
  function (this: StepWorld) {
    assert.deepEqual(this.result.additionalMacro, true);
  },
);

Then(
  "The standalone and bundled versions are registered with different Pi APIs",
  function (this: StepWorld) {
    assert.deepEqual(this.result.distinctApis, true);
  },
);

Given(
  "the XDG user macros are as follows",
  function (this: StepWorld, table: import("@cucumber/cucumber").DataTable) {
    const macros = Object.fromEntries(
      table.rows().map(([name, replacement, arity]) => {
        if (arity !== "なし" && !/^\d+$/u.test(arity))
          throw new Error(`Unknown macro arity: ${arity}`);
        return [
          name,
          arity === "なし"
            ? replacement
            : ([replacement, Number(arity)] as const),
        ];
      }),
    );
    writeConfig(this, macros);
  },
);

Given(
  "the environment variable user macros are as follows",
  (table: import("@cucumber/cucumber").DataTable) => {
    const macros = Object.fromEntries(
      table.rows().map(([name, replacement, arity]) => {
        if (arity !== "なし" && !/^\d+$/u.test(arity))
          throw new Error(`Unknown macro arity: ${arity}`);
        return [
          name,
          arity === "なし"
            ? replacement
            : ([replacement, Number(arity)] as const),
        ];
      }),
    );
    process.env.PI_FORMULA_MACROS = JSON.stringify(macros);
  },
);

Given("the environment variable macro setting is invalid JSON", () => {
  process.env.PI_FORMULA_MACROS = "{";
});

Given("the image path public API is in use", async function (this: StepWorld) {
  await registeredImageApi(this);
});

When(
  "create a PNG of the reference formula {string} through the public API",
  function (this: StepWorld, latex: string) {
    this.expectedImage = freshApi().createFormulaPng(latex, 80);
  },
);

When("create a PNG from an invalid user macro", function (this: StepWorld) {
  this.brokenImage = this.formula.createFormulaPng("\\broken{x}", 80);
});

When("mutate the returned public PNG Buffer", function (this: StepWorld) {
  if (!this.mutableImage)
    throw new Error("Expected a PNG before mutating its buffer");
  this.mutableImage.data[0] = 0;
});

When(
  "create another public PNG of the same formula",
  function (this: StepWorld) {
    this.imageAfterMutation = this.integration.createPng("x");
  },
);

When(
  "render the same formula as Markdown display math",
  function (this: StepWorld) {
    this.markdownAfterMutation = this.pi.transformer()("$$x$$", {
      messageType: "assistant",
      isStreaming: false,
      availableWidth: 80,
    });
  },
);

When("change the theme text color to RGB 1, 2, 3", function (this: StepWorld) {
  this.started.setTextColor("\x1b[38;2;1;2;3m");
});

When(
  "create a public PNG of the same formula after the theme change",
  function (this: StepWorld) {
    this.imageAfterThemeChange = this.integration.createPng("x");
  },
);

When(
  "change the XDG user macro definition for reloading",
  function (this: StepWorld) {
    writeConfig(this, { reloaded: "x" });
  },
);

When(
  "change the environment variable user macro definition for reloading",
  () => {
    process.env.PI_FORMULA_MACROS = JSON.stringify({ temporary: "y" });
  },
);

When("load and register another runtime", function (this: StepWorld) {
  this.secondRuntime = loadStandaloneExtension();
  this.secondPi = fakePi();
  this.secondRuntime.register(this.secondPi.api);
});

When(
  "start an image path session in the new runtime",
  async function (this: StepWorld) {
    await startWithKitty(this.secondPi);
  },
);

When(
  "create a PNG with the new runtime user macro",
  function (this: StepWorld) {
    this.reloadedImage = this.secondRuntime.formula.createFormulaPng(
      "\\reloaded+\\temporary",
      80,
    );
  },
);

When(
  "create a PNG of the reference formula through the public API",
  function (this: StepWorld, latex: string) {
    this.expectedImage = freshApi().createFormulaPng(latex, 80);
  },
);

Then("The public PNG height is positive", function (this: StepWorld) {
  assert.ok((this.image?.heightPx ?? 0) > 0);
});

When(
  "render display math without dynamic glyphs in the same runtime",
  async function (this: StepWorld) {
    const result = await this.isolatedRenderer.request("render", {
      markdown: "$$x$$",
    });
    this.dynamicFontResult.ordinaryImage =
      result.markdown.includes("\x1b_Ga=T,f=100");
  },
);

When("load the first extension in the load order", function (this: StepWorld) {
  if (this.extensionOrder === "bundled")
    this.bundled = loadIntegrationExtension();
  else this.standalone = loadStandaloneExtension();
});

When("load the next extension in the load order", function (this: StepWorld) {
  if (this.extensionOrder === "bundled")
    this.standalone = loadStandaloneExtension();
  else this.bundled = loadIntegrationExtension();
});

When(
  "register the first extension in the load order",
  function (this: StepWorld) {
    if (this.extensionOrder === "bundled")
      this.integration = this.bundled.register(this.bundledPi.api);
    else this.standalone.register(this.standalonePi.api);
  },
);

When(
  "register the next extension in the load order",
  function (this: StepWorld) {
    if (this.extensionOrder === "bundled")
      this.standalone.register(this.standalonePi.api);
    else this.integration = this.bundled.register(this.bundledPi.api);
  },
);

When(
  "start an image path session in the first registered Pi",
  async function (this: StepWorld) {
    await startWithKitty(
      this.extensionOrder === "bundled" ? this.bundledPi : this.standalonePi,
    );
  },
);

When(
  "create an integration extension PNG in the runtime with both registered",
  function (this: StepWorld) {
    this.integrationImage = this.integration.createPng("\\trial{x}", 80);
  },
);

Then("The prebuilt PNG file transfers a PNG image", function (this: StepWorld) {
  assert.equal(
    (this.renderedPng.rendered ? this.renderedPng.output : undefined)?.includes(
      "iVBOR",
    ),
    true,
  );
});

Then(
  "The rejection result contains only render status and rejection reason",
  function (this: StepWorld) {
    assert.deepEqual(Object.keys(this.renderedPng).sort(), [
      "reason",
      "rendered",
    ]);
  },
);

After(async function (this: StepWorld) {
  if (this.isolatedRenderer) await this.isolatedRenderer.close();
});

When("read the SGR state after placeholder output", function (this: StepWorld) {
  this.placeholderRendition = finalSgrRendition(
    (this.renderedPng.rendered ? this.renderedPng.output : undefined) ?? "",
  );
});
