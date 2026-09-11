const fs = require("node:fs");
const path = require("node:path");

const { createPng } = require("./png-fixture");

class DisplayProcessAdapter {
  constructor(options = {}) {
    this.options = options;
    this.requests = [];
    this.terminated = false;
  }

  async run(request) {
    this.requests.push(request);
    if (request.operation === "plan") {
      if (this.options.planFailure) return this.options.planFailure;
      return {
        status: 0,
        stdout: JSON.stringify(
          this.options.plan ?? {
            height: 80,
            initialWidth: 120,
            reflowWidth: null,
            imageRows: 1,
            displayFormulas: 1,
            failedFormulas: 0,
          },
        ),
        stderr: "",
        timedOut: false,
      };
    }
    if (
      request.operation?.startsWith("capture-") &&
      this.options.captureTimeout
    ) {
      return { status: 2, stdout: "", stderr: "timeout", timedOut: true };
    }
    if (request.operation?.startsWith("capture-")) {
      this.captureCount = (this.captureCount ?? 0) + 1;
      const dimensions =
        request.operation === "capture-reflow"
          ? (this.options.plan?.reflowWidth ?? 80)
          : (this.options.plan?.initialWidth ?? 120);
      const height = this.options.plan?.height ?? 80;
      const captureWidth = this.options.wrongDimensions
        ? dimensions + 1
        : dimensions;
      const shade = this.options.unstable ? this.captureCount % 255 : 250;
      let png = createPng(captureWidth, height, () => [shade, 248, 240]);
      if (this.options.invalidPng) png = Buffer.from("not a png");
      if (this.options.truncatedPng) png = png.subarray(0, 24);
      fs.writeFileSync(request.args[0], png);
    }
    return { status: 0, stdout: "", stderr: "", timedOut: false };
  }

  spawn(request) {
    this.requests.push(request);
    if (this.options.spawnError) throw new Error(this.options.spawnError);
    const directory = path.dirname(request.args.at(-1));
    const corpus = this.options.corpus;
    fs.writeFileSync(path.join(directory, "wayland-display"), "wayland-test\n");
    fs.writeFileSync(path.join(directory, "wayland-output"), "HEADLESS-1\n");
    fs.writeFileSync(
      path.join(directory, "display-path"),
      `${this.options.selectedPath ?? "image"}\n`,
    );
    const response = this.options.response ?? fs.readFileSync(corpus, "utf8");
    if (this.options.blockCageLog) {
      fs.mkdirSync(path.join(directory, "cage.log"));
    }
    if (this.options.blockResult) {
      fs.mkdirSync(path.join(directory, "result.json"));
    }
    fs.writeFileSync(
      path.join(directory, "session.jsonl"),
      `${JSON.stringify({
        type: "message",
        message: {
          role: "assistant",
          stopReason: "stop",
          content: [{ type: "text", text: response }],
        },
      })}\n`,
    );
    let complete;
    const completion = new Promise((resolve) => {
      complete = resolve;
    });
    return {
      pid: 12345,
      completion,
      terminate: async () => {
        this.terminated = true;
        if (this.options.terminationError) {
          throw new Error(this.options.terminationError);
        }
        complete({ status: 0, stdout: "", stderr: "", timedOut: false });
        return this.options.cleanupDiagnostics ?? [];
      },
    };
  }
}

module.exports = { DisplayProcessAdapter };
