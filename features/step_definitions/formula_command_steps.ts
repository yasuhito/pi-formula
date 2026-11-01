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
  "端末 `{word}` でPiを使っている",
  function (this: StepWorld, terminal: string) {
    // Alacritty is modeled by no PNG-query response, without a multiplexer.
    const responses = new Map([
      ["Ghostty", "OK"],
      ["Kitty", "OK"],
      ["Alacritty", undefined],
    ]);
    if (!responses.has(terminal)) {
      throw new Error(`Unknown terminal fixture: ${terminal}`);
    }
    this.terminal = terminal;
    this.startOptions = { response: responses.get(terminal) };
    this.pi = fakePi();
    registerFormula(this.pi.api);
  },
);

When("セッションを開始する", async function (this: StepWorld) {
  this.started = await withEnvironment(
    {
      TERM_PROGRAM: this.terminal,
      TERM: this.term,
      TMUX: this.tmux,
    },
    () => startSession(this.pi, this.startOptions),
  );
});

Then("`{word}`経路が選ばれる", async function (this: StepWorld, path: string) {
  const paths = new Map([
    ["画像", "image"],
    ["テキスト", "text"],
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
});

function preparePi(
  world: StepWorld,
  startOptions: StepWorld["startOptions"] = {},
) {
  world.pi = fakePi();
  registerFormula(world.pi.api);
  world.startOptions = startOptions;
}

Given("端末でPiを使っている", function (this: StepWorld) {
  preparePi(this);
});

Given("PNG画像を表示できる端末でPiを使っている", function (this: StepWorld) {
  preparePi(this, { response: "OK" });
});

Given("Piを非対話モード（RPC）で使っている", function (this: StepWorld) {
  preparePi(this, { mode: "rpc" });
});

Given("端末はPNG画像を表示できると返答する", function (this: StepWorld) {
  this.startOptions.response = "OK";
});

Given(
  "端末はPNG画像表示の問い合わせにエラーを返す",
  function (this: StepWorld) {
    this.startOptions.response = "EINVAL";
  },
);

Given("端末はPNG画像表示の問い合わせに応答しない", function (this: StepWorld) {
  delete this.startOptions.response;
});

Given("端末の種類は {string}", function (this: StepWorld, term: string) {
  this.term = term;
});

Given("tmuxの中でPiを使っている", function (this: StepWorld) {
  this.tmux = "1";
});

Given("全体の既定の表示経路は設定されていない", function (this: StepWorld) {
  if (existsSync(join(this.xdg, "pi-formula", "config.json"))) {
    throw new Error("Expected an unset global path fixture");
  }
});

Given("全体の設定ファイルは存在しない", function (this: StepWorld) {
  if (existsSync(join(this.xdg, "pi-formula", "config.json"))) {
    throw new Error("Expected no global config file");
  }
});

Given("全体の既定の表示経路はテキスト経路である", function (this: StepWorld) {
  const directory = join(this.xdg, "pi-formula");
  mkdirSync(directory, { recursive: true });
  writeFileSync(
    join(directory, "config.json"),
    JSON.stringify({ path: "text" }),
  );
});

Given("利用者マクロを1個設定している", () => {
  process.env.PI_FORMULA_MACROS = JSON.stringify({ secret: "x" });
});

Given("マクロの内容に秘密の文字列が含まれる", () => {
  process.env.PI_FORMULA_MACROS = JSON.stringify({
    secret: "do-not-show-this",
  });
});

When(
  "formula {word}を実行する",
  async function (this: StepWorld, action: string) {
    await this.pi.commands.get("formula").handler(action, this.started.ctx);
    if (action === "status")
      this.lines = this.started.widgets.get("pi-formula-status");
  },
);

When(
  "formula {word} --defaultを実行する",
  async function (this: StepWorld, action: string) {
    await this.pi.commands
      .get("formula")
      .handler(`${action} --default`, this.started.ctx);
  },
);

When(
  "数式 {string} を画像へ変換する",
  function (this: StepWorld, markdown: string) {
    this.rendered = this.pi.transformer()(markdown, {
      messageType: "assistant",
      isStreaming: false,
      availableWidth: 80,
    });
  },
);

Then("画像経路が選ばれる", async function (this: StepWorld) {
  assert.equal(
    (await statusLines(this.pi, this.started)).find((line) =>
      line.startsWith("path:"),
    ),
    "path: image",
  );
});

Then("テキスト経路が選ばれる", async function (this: StepWorld) {
  assert.equal(
    (await statusLines(this.pi, this.started)).find((line) =>
      line.startsWith("path:"),
    ),
    "path: text",
  );
});

Then(
  "表示経路の指定が次の順に記録される",
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
  "選択理由はPNG画像表示の問い合わせの成功になる",
  async function (this: StepWorld) {
    assert.equal(
      (await statusLines(this.pi, this.started)).find((line) =>
        line.startsWith("reason:"),
      ),
      "reason: PNG query returned OK",
    );
  },
);

Then("全体の設定ファイルは作られない", function (this: StepWorld) {
  assert.equal(existsSync(join(this.xdg, "pi-formula", "config.json")), false);
});

Then(
  "全体の既定の表示経路は画像経路として保存される",
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
  "表示経路だけを持つ全体の設定ファイルは削除される",
  function (this: StepWorld) {
    assert.equal(
      existsSync(join(this.xdg, "pi-formula", "config.json")),
      false,
    );
  },
);

Then("画像の一時保存に1件以上が含まれる", async function (this: StepWorld) {
  assert.match(
    (await statusLines(this.pi, this.started)).find((line) =>
      line.startsWith("cache:"),
    ) ?? "",
    /^cache: [1-9]\d* entries, [1-9]\d* bytes$/u,
  );
});

Then("画像の一時保存が空になる", async function (this: StepWorld) {
  assert.equal(
    (await statusLines(this.pi, this.started)).find((line) =>
      line.startsWith("cache:"),
    ),
    "cache: 0 entries, 0 bytes",
  );
});

Then(
  "診断には次の項目だけがこの順に含まれる",
  function (this: StepWorld, table: import("@cucumber/cucumber").DataTable) {
    const fieldNames = new Map([
      ["版", "pi-formula 0.1.1"],
      ["経路", "path"],
      ["理由", "reason"],
      ["端末", "terminal"],
      ["セリフ体", "serif"],
      ["マクロ数", "macros"],
      ["数式色", "color"],
      ["一時保存", "cache"],
      ["直近の失敗", "last failure"],
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

Then("診断情報はすべて印字可能なASCII文字である", function (this: StepWorld) {
  assert.equal(
    this.lines.every((line) => /^[\x20-\x7e]+$/u.test(line)),
    true,
  );
});

Then("診断に表示される利用者マクロの数は1である", function (this: StepWorld) {
  assert.equal(
    this.lines.find((line) => line.startsWith("macros:")),
    "macros: 1",
  );
});

Then("診断情報に秘密のマクロ内容は含まれない", function (this: StepWorld) {
  assert.equal(this.lines.join("\n").includes("do-not-show-this"), false);
});

Then("端末の画像表示機能を問い合わせない", function (this: StepWorld) {
  assert.equal(this.started.terminalWrites, 0);
});
