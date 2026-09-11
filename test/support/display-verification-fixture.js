const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const { verifyDisplay } = require("../../dist/display-verification.js");
const { DisplayProcessAdapter } = require("./display-process-adapter.js");

function createDisplayVerificationFixture(overrides = {}, adapterOptions = {}) {
  const directory = fs.mkdtempSync(
    path.join(os.tmpdir(), "pi-formula-display-verification-"),
  );
  const corpus = path.join(directory, "corpus.md");
  const extension = path.join(directory, "extension.ts");
  fs.writeFileSync(corpus, "$$x$$\n");
  fs.writeFileSync(extension, "export default () => {};\n");
  const processAdapter = new DisplayProcessAdapter({
    corpus,
    ...adapterOptions,
  });
  const options = {
    corpus,
    extension,
    theme: "light",
    terminal: "ghostty",
    path: "image",
    reflow: null,
    artifactsRoot: path.join(directory, "artifacts"),
    ...overrides,
  };
  return {
    directory,
    options,
    processAdapter,
    cleanup() {
      fs.rmSync(directory, { recursive: true, force: true });
    },
    run(dependencies = {}) {
      return verifyDisplay(options, {
        process: processAdapter,
        rootDirectory: path.resolve(__dirname, "../.."),
        platform: "linux",
        pollIntervalMs: 1,
        ...dependencies,
      });
    },
  };
}

module.exports = { createDisplayVerificationFixture };
