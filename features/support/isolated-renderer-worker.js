const Module = require("node:module");
const crypto = require("node:crypto");
const { performance } = require("node:perf_hooks");

const configuration = JSON.parse(process.argv[2]);
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
let registerFormula;
let fakePi;
let startWithKitty;
let pi;

async function execute(operation, payload) {
  switch (operation) {
    case "load": {
      registerFormula = require("../../dist/extension.js").default;
      ({ fakePi, startWithKitty } = require("../../test/support/fake-pi"));
      const { FORMULA_SAFETY_LIMITS } = require("../../dist/typesetter.js");
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

process.on("message", async ({ id, operation, payload }) => {
  try {
    process.send({ id, result: await execute(operation, payload) });
  } catch (error) {
    process.send({ id, error: error.stack });
  }
});
