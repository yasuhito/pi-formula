import Module from "node:module";
import type { ModuleLoader } from "./module-loader.js";

const moduleLoader = Module as ModuleLoader;
if (typeof moduleLoader._load !== "function")
  throw new Error("Node Module._load hook is unavailable");

const originalLoad = moduleLoader._load;
moduleLoader._load = function load(request, parent, isMain) {
  if (
    /mathjax-newcm-font\/js\/svg\/dynamic\/calligraphic\.js$/u.test(request)
  ) {
    throw new Error(`blocked dynamic font: ${request}`);
  }
  return originalLoad.call(this, request, parent, isMain);
};

async function main() {
  const registerFormula: typeof import("../../dist/extension.js").default =
    require("../../dist/extension.js").default;
  const {
    fakePi,
    startWithKitty,
  }: typeof import("./fake-pi") = require("./fake-pi");
  const pi = fakePi();
  registerFormula(pi.api);
  await startWithKitty(pi);
  const transform = pi.transformer();
  const context = {
    messageType: "assistant" as const,
    isStreaming: false,
    availableWidth: 80,
  };
  const dynamic = transform("$$\\mathcal{L}$$", context);
  const ordinary = transform("$$x$$", context);
  process.stdout.write(
    JSON.stringify({
      dynamic,
      ordinaryImage: ordinary.includes("\x1b_Ga=T,f=100"),
    }),
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => {
    moduleLoader._load = originalLoad;
  });
