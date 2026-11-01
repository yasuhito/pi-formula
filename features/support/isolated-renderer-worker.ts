import type {
  RendererConfiguration,
  RendererOperation,
  RendererPayload,
  RendererRequest,
  RendererResult,
} from "./isolated-renderer.js";

const Module: typeof import("../../test/support/module-loader.js").moduleLoader = require("node:module");
const crypto: typeof import("node:crypto") = require("node:crypto");
const {
  performance,
}: typeof import("node:perf_hooks") = require("node:perf_hooks");

const configuration: RendererConfiguration = JSON.parse(process.argv[2]);
let keyCreations = 0;
if (configuration.blockKeyCreation) {
  crypto.createHash = () => {
    keyCreations += 1;
    throw new Error("unexpected key creation");
  };
}
if (configuration.blockDynamicFont) {
  const originalLoad = Module._load;
  Module._load = function (request, parent, isMain) {
    if (
      /mathjax-newcm-font\/js\/svg\/dynamic\/calligraphic\.js$/u.test(request)
    ) {
      throw new Error(`blocked dynamic font: ${request}`);
    }
    return originalLoad.call(this, request, parent, isMain);
  };
}
const loaded = () =>
  Object.keys(require.cache).some(
    (path) => path.includes("@mathjax/src") || path.includes("@resvg/resvg-js"),
  );
let registerFormula: typeof import("../../dist/extension.js").default;
let fakePi: typeof import("../../test/support/fake-pi.js").fakePi;
let startWithKitty: typeof import("../../test/support/fake-pi.js").startWithKitty;
let pi: ReturnType<typeof fakePi>;

async function execute(
  operation: RendererOperation,
  payload: RendererPayload,
): Promise<RendererResult> {
  switch (operation) {
    case "load": {
      registerFormula = require("../../dist/extension.js").default;
      ({ fakePi, startWithKitty } = require("../../test/support/fake-pi"));
      const {
        FORMULA_SAFETY_LIMITS,
      }: typeof import("../../dist/typesetter.js") = require("../../dist/typesetter.js");
      return { loaded: loaded(), limits: FORMULA_SAFETY_LIMITS };
    }
    case "register":
      pi = fakePi();
      registerFormula(pi.api);
      return { loaded: loaded() };
    case "start":
      await startWithKitty(pi);
      return { loaded: loaded() };
    case "render": {
      if (typeof payload.markdown !== "string")
        throw new Error("render requires Markdown text");
      const started = performance.now();
      const markdown = pi.transformer()(payload.markdown, {
        messageType: "assistant",
        isStreaming: false,
        availableWidth: 80,
      });
      const duration = performance.now() - started;
      return { markdown, duration, loaded: loaded(), keyCreations };
    }
    default:
      throw new Error(`unknown isolated renderer operation: ${operation}`);
  }
}

process.on("message", async ({ id, operation, payload }: RendererRequest) => {
  try {
    process.send?.({ id, result: await execute(operation, payload) });
  } catch (error) {
    process.send?.({
      id,
      error: error instanceof Error ? error.stack : String(error),
    });
  }
});
