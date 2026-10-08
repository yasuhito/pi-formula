import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type {
  DisplayVerificationDependencies,
  DisplayVerificationOptions,
} from "../../dist/display-verification.js";
import type { AdapterOptions } from "./display-process-adapter.js";

const {
  verifyDisplay,
}: typeof import("../../dist/display-verification.js") = require("../../dist/display-verification.js");

import { DisplayProcessAdapter } from "./display-process-adapter.js";

function createDisplayVerificationFixture(
  overrides: Partial<DisplayVerificationOptions> = {},
  adapterOptions: AdapterOptions = {},
) {
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
  const options: DisplayVerificationOptions = {
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
    run(dependencies: Partial<DisplayVerificationDependencies> = {}) {
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

export { createDisplayVerificationFixture };
