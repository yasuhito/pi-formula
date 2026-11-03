interface StepWorld {
  lines: string[];
  pi: ReturnType<typeof fakePi>;
  rendered: string;
  startOptions: import("../../test/support/fake-pi.js").SessionOptions;
  started: Awaited<ReturnType<typeof startSession>>;
  term: string | undefined;
  terminal: string | undefined;
  tmux: string | undefined;
  xdg: string;
}

const assert: typeof import("node:assert/strict") = require("node:assert/strict");
const {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
}: typeof import("node:fs") = require("node:fs");
const { join }: typeof import("node:path") = require("node:path");
const {
  Given,
  Then,
  When,
}: typeof import("@cucumber/cucumber") = require("@cucumber/cucumber");

const registerFormula: typeof import("../../dist/extension.js").default =
  require("../../dist/extension.js").default;
const {
  fakePi,
  startSession,
}: typeof import("../../test/support/fake-pi") = require("../../test/support/fake-pi");

function withEnvironment<T>(
  changes: Record<string, string | undefined>,
  run: () => T | Promise<T>,
): Promise<T> {
  const original: Record<string, string | undefined> = {};
  for (const [name, value] of Object.entries(changes)) {
    original[name] = process.env[name];
    if (value === undefined) delete process.env[name];
    else process.env[name] = value;
  }
  return Promise.resolve(run()).finally(() => {
    for (const [name, value] of Object.entries(original)) {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
  });
}

async function statusLines(pi: StepWorld["pi"], started: StepWorld["started"]) {
  await pi.commands.get("formula").handler("status", started.ctx);
  return started.widgets.get("pi-formula-status");
}

Given(
  "Pi is running in the `{word}` terminal",
  function (this: StepWorld, terminal: string) {
    const terminals = new Map([
      ["Ghostty", { pngQuery: "OK", multiplexer: undefined }],
      ["Kitty", { pngQuery: "OK", multiplexer: undefined }],
      ["Alacritty", { pngQuery: undefined, multiplexer: undefined }],
    ]);
    const fixture = terminals.get(terminal);
    if (!fixture) {
      throw new Error(`Unknown terminal fixture: ${terminal}`);
    }
    this.terminal = terminal;
    this.startOptions = { response: fixture.pngQuery };
    this.tmux = fixture.multiplexer;
    this.pi = fakePi();
    registerFormula(this.pi.api);
  },
);

When("start a session", async function (this: StepWorld) {
  this.started = await withEnvironment(
    {
      TERM_PROGRAM: this.terminal,
      TERM: this.term,
      TMUX: this.tmux,
    },
    () => startSession(this.pi, this.startOptions),
  );
});

Then(
  "The `{word}` path is selected",
  async function (this: StepWorld, path: string) {
    const paths = new Map([
      ["image", "image"],
      ["text", "text"],
    ]);
    if (!paths.has(path)) {
      throw new Error(`Unknown path label: ${path}`);
    }
    assert.equal(
      (await statusLines(this.pi, this.started)).find((line) =>
        line.startsWith("path:"),
      ),
      `path: ${paths.get(path)}`,
    );
  },
);

function preparePi(
  world: StepWorld,
  startOptions: StepWorld["startOptions"] = {},
) {
  world.pi = fakePi();
  registerFormula(world.pi.api);
  world.startOptions = startOptions;
}

Given("Pi is running in a terminal", function (this: StepWorld) {
  preparePi(this);
});

Given(
  "Pi is running in a terminal that can display PNG images",
  function (this: StepWorld) {
    preparePi(this, { response: "OK" });
  },
);

Given("Pi is running in noninteractive RPC mode", function (this: StepWorld) {
  preparePi(this, { mode: "rpc" });
});

Given(
  "the terminal responds that it can display PNG images",
  function (this: StepWorld) {
    this.startOptions.response = "OK";
  },
);

Given(
  "the terminal returns an error to the PNG display query",
  function (this: StepWorld) {
    this.startOptions.response = "EINVAL";
  },
);

Given(
  "the terminal does not respond to the PNG display query",
  function (this: StepWorld) {
    delete this.startOptions.response;
  },
);

Given(
  "the terminal type is {string}",
  function (this: StepWorld, term: string) {
    this.term = term;
  },
);

Given("Pi is running inside tmux", function (this: StepWorld) {
  this.tmux = "1";
});

Given(
  "The global default display path is not configured",
  function (this: StepWorld) {
    if (existsSync(join(this.xdg, "pi-formula", "config.json"))) {
      throw new Error("Expected an unset global path fixture");
    }
  },
);

Given("the global settings file does not exist", function (this: StepWorld) {
  if (existsSync(join(this.xdg, "pi-formula", "config.json"))) {
    throw new Error("Expected no global config file");
  }
});

Given(
  "the global default display path is the text path",
  function (this: StepWorld) {
    const directory = join(this.xdg, "pi-formula");
    mkdirSync(directory, { recursive: true });
    writeFileSync(
      join(directory, "config.json"),
      JSON.stringify({ path: "text" }),
    );
  },
);

Given("one user macro is configured", () => {
  process.env.PI_FORMULA_MACROS = JSON.stringify({ secret: "x" });
});

Given("the macro contents include a secret string", () => {
  process.env.PI_FORMULA_MACROS = JSON.stringify({
    secret: "do-not-show-this",
  });
});

When("run formula {word}", async function (this: StepWorld, action: string) {
  await this.pi.commands.get("formula").handler(action, this.started.ctx);
  if (action === "status")
    this.lines = this.started.widgets.get("pi-formula-status");
});

When(
  "run formula {word} --default",
  async function (this: StepWorld, action: string) {
    await this.pi.commands
      .get("formula")
      .handler(`${action} --default`, this.started.ctx);
  },
);

When(
  "convert the formula {string} to an image",
  function (this: StepWorld, markdown: string) {
    this.rendered = this.pi.transformer()(markdown, {
      messageType: "assistant",
      isStreaming: false,
      availableWidth: 80,
    });
  },
);

Then("The image path is selected", async function (this: StepWorld) {
  assert.equal(
    (await statusLines(this.pi, this.started)).find((line) =>
      line.startsWith("path:"),
    ),
    "path: image",
  );
});

Then("The text path is selected", async function (this: StepWorld) {
  assert.equal(
    (await statusLines(this.pi, this.started)).find((line) =>
      line.startsWith("path:"),
    ),
    "path: text",
  );
});

Then(
  "Display path selections are recorded in the following order",
  function (this: StepWorld, table: import("@cucumber/cucumber").DataTable) {
    assert.deepEqual(
      this.pi.entries.map((entry) =>
        typeof entry.data === "object" &&
        entry.data !== null &&
        "path" in entry.data
          ? entry.data.path
          : undefined,
      ),
      table.rows().map(([action]) => action),
    );
  },
);

Then(
  "The selection reason is a successful PNG display query",
  async function (this: StepWorld) {
    assert.equal(
      (await statusLines(this.pi, this.started)).find((line) =>
        line.startsWith("reason:"),
      ),
      "reason: PNG query returned OK",
    );
  },
);

Then("No global settings file is created", function (this: StepWorld) {
  assert.equal(existsSync(join(this.xdg, "pi-formula", "config.json")), false);
});

Then(
  "The global default display path is saved as the image path",
  function (this: StepWorld) {
    assert.equal(
      JSON.parse(
        readFileSync(join(this.xdg, "pi-formula", "config.json"), "utf8"),
      ).path,
      "image",
    );
  },
);

Then(
  "The global settings file containing only the display path is deleted",
  function (this: StepWorld) {
    assert.equal(
      existsSync(join(this.xdg, "pi-formula", "config.json")),
      false,
    );
  },
);

Then(
  "The image cache contains at least one entry",
  async function (this: StepWorld) {
    assert.match(
      (await statusLines(this.pi, this.started)).find((line) =>
        line.startsWith("cache:"),
      ) ?? "",
      /^cache: [1-9]\d* entries, [1-9]\d* bytes$/u,
    );
  },
);

Then("The image cache becomes empty", async function (this: StepWorld) {
  assert.equal(
    (await statusLines(this.pi, this.started)).find((line) =>
      line.startsWith("cache:"),
    ),
    "cache: 0 entries, 0 bytes",
  );
});

Then(
  "Diagnostics contain only the following fields in this order",
  function (this: StepWorld, table: import("@cucumber/cucumber").DataTable) {
    const fieldNames = new Map([
      ["version", "pi-formula 0.1.2"],
      ["path", "path"],
      ["reason", "reason"],
      ["terminal", "terminal"],
      ["serif", "serif"],
      ["macros", "macros"],
      ["color", "color"],
      ["cache", "cache"],
      ["last failure", "last failure"],
    ]);
    const expected = table.rows().map(([label]) => {
      if (!fieldNames.has(label))
        throw new Error(`Unknown diagnostic field: ${label}`);
      return fieldNames.get(label);
    });
    assert.deepEqual(
      this.lines.map((line) => line.split(":")[0]),
      expected,
    );
  },
);

Then(
  "Diagnostics contain only printable ASCII characters",
  function (this: StepWorld) {
    assert.equal(
      this.lines.every((line) => /^[\x20-\x7e]+$/u.test(line)),
      true,
    );
  },
);

Then(
  "The user macro count shown in diagnostics is 1",
  function (this: StepWorld) {
    assert.equal(
      this.lines.find((line) => line.startsWith("macros:")),
      "macros: 1",
    );
  },
);

Then(
  "Diagnostics do not contain secret macro contents",
  function (this: StepWorld) {
    assert.equal(this.lines.join("\n").includes("do-not-show-this"), false);
  },
);

Then(
  "The terminal image display capability is not queried",
  function (this: StepWorld) {
    assert.equal(this.started.terminalWrites, 0);
  },
);
