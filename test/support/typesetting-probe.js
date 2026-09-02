const fs = require("node:fs");
const Module = require("node:module");
const { createPng } = require("./png-fixture");

const inventory = process.argv[2];
const text = process.argv[3];
const originalReaddirSync = fs.readdirSync;
const originalLoad = Module._load;
let rasterized;
let rasterPng;

function isFontDirectory(path) {
  return /(?:^|[/\\])(?:fonts|\.fonts)(?:[/\\]|$)/iu.test(String(path));
}

const inventoryFiles = {
  priority: [
    "ipaexm.ttf",
    "SourceHanSerifJP-Regular.otf",
    "NotoSerifCJK-Regular.ttc",
  ],
  "source-jp": ["SourceHanSerifJP-Regular.otf"],
  source: ["SourceHanSerif-Regular.otf"],
  ipa: ["ipaexm.ttf"],
  fallback: [],
};

fs.readdirSync = (path, options) => {
  if (!isFontDirectory(path)) return originalReaddirSync(path, options);
  return (inventoryFiles[inventory] ?? []).map((name) => ({
    name,
    isDirectory: () => false,
    isFile: () => true,
  }));
};

class ObservedResvg {
  constructor(svg, options) {
    rasterized = { svg, options };
  }

  render() {
    rasterPng = createPng(1, 1, () => [0, 0, 0]);
    return { asPng: () => rasterPng };
  }
}

Module._load = function load(request, parent, isMain) {
  if (request === "@resvg/resvg-js") return { Resvg: ObservedResvg };
  return originalLoad.call(this, request, parent, isMain);
};

function attribute(source, name) {
  return new RegExp(`\\b${name}="([^"]+)"`, "u").exec(source)?.[1];
}

async function main() {
  const registerFormula = require("../../dist/extension.js").default;
  const { fakePi, startWithKitty } = require("./fake-pi");
  const pi = fakePi();
  registerFormula(pi.api);
  const started = await startWithKitty(pi);
  const latex = String.raw`A(j) = \begin{cases} \dfrac{1}{2}\, e^{-\pi i j /4} & j \equiv 0 \pmod 4 \\ 0 & \text{${text}} \end{cases}`;
  const rendered = pi.transformer()(`$$${latex}$$`, {
    messageType: "assistant",
    isStreaming: false,
    availableWidth: 80,
  });
  await pi.commands.get("formula").handler("status", started.ctx);

  const textElement = /<text\b([^>]*)>([^<]*)<\/text>/u.exec(rasterized.svg);
  process.stdout.write(
    JSON.stringify({
      image: rendered.includes("\x1b_Ga=T,f=100"),
      pngSignature: rasterPng.subarray(0, 8).toString("hex"),
      font: rasterized.options.font,
      pathCount: (rasterized.svg.match(/<path\b/gu) ?? []).length,
      text:
        textElement === null
          ? null
          : {
              value: textElement[2],
              family: attribute(textElement[1], "font-family"),
              size: attribute(textElement[1], "font-size"),
              baseline: attribute(textElement[1], "transform"),
            },
      status: started.widgets
        .get("pi-formula-status")
        .find((line) => line.startsWith("serif:")),
    }),
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => {
    fs.readdirSync = originalReaddirSync;
    Module._load = originalLoad;
  });
