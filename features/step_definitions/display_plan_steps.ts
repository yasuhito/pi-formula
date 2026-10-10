interface StepWorld {
  directory: string;
  planCorpus: string;
  planResult: import("node:child_process").SpawnSyncReturns<string>;
}

const assert: typeof import("node:assert/strict") = require("node:assert/strict");
const fs: typeof import("node:fs") = require("node:fs");
const os: typeof import("node:os") = require("node:os");
const path: typeof import("node:path") = require("node:path");
const {
  spawnSync,
}: typeof import("node:child_process") = require("node:child_process");
const {
  Given,
  Then,
  When,
}: typeof import("@cucumber/cucumber") = require("@cucumber/cucumber");

const root = path.resolve(__dirname, "../..");

function createPlanCorpus(world: StepWorld, name: string, corpus: string) {
  world.directory = fs.mkdtempSync(
    path.join(os.tmpdir(), "pi-formula-cucumber-plan-"),
  );
  world.planCorpus = path.join(world.directory, name);
  fs.writeFileSync(world.planCorpus, corpus);
}

function runPlanBoundary(
  world: StepWorld,
  script: string,
  ...options: string[]
) {
  world.planResult = spawnSync(
    process.execPath,
    [path.join(root, `scripts/${script}`), ...options, world.planCorpus],
    { encoding: "utf8", timeout: 15_000 },
  );
  fs.rmSync(world.directory, { recursive: true, force: true });
}

Given(
  "組版できる式と組版できない式を含むコーパスがある",
  function (this: StepWorld) {
    createPlanCorpus(
      this,
      "typesetting-failure.md",
      ["$$x$$", "$$\\undefinedcommandhere$$"].join("\n\n"),
    );
  },
);

Given("組版できない表示数式だけのコーパスがある", function (this: StepWorld) {
  createPlanCorpus(
    this,
    "all-typesetting-failures.md",
    "$$\\undefinedcommandhere$$",
  );
});

Given("読み取れないコーパスのパスがある", function (this: StepWorld) {
  this.directory = fs.mkdtempSync(
    path.join(os.tmpdir(), "pi-formula-cucumber-plan-"),
  );
  this.planCorpus = path.join(this.directory, "missing.md");
});

Given(
  "100 列へのリフローで折り返しが増えるコーパスがある",
  function (this: StepWorld) {
    createPlanCorpus(this, "reflow.md", `${"あ".repeat(6_000)}\n\n$$x$$`);
  },
);

Given(
  "100 列へのリフロー後だけ上限を超えるコーパスがある",
  function (this: StepWorld) {
    createPlanCorpus(
      this,
      "too-tall-after-reflow.md",
      `${"a".repeat(27_000)}\n\n$$x$$`,
    );
  },
);

Given(
  "全角文字と空白を含む Markdown 表のコーパスがある",
  function (this: StepWorld) {
    const rows = ["| A | B |", "|---|---|"];
    for (let row = 0; row < 30; row += 1) {
      rows.push(`| ${"日本語".repeat(20)} | ${"word ".repeat(20)} |`);
    }
    createPlanCorpus(this, "table.md", `${rows.join("\n")}\n\n$$x$$`);
  },
);

Given("100 列では読めない縮尺になる表示数式がある", function (this: StepWorld) {
  const latex = Array.from({ length: 30 }, (_, index) => `x_${index}`).join(
    "+",
  );
  createPlanCorpus(this, "scaled.md", `$$${latex}$$`);
});

Given("60 個の短い表示数式を含むコーパスがある", function (this: StepWorld) {
  createPlanCorpus(
    this,
    "many-formulas.md",
    Array.from({ length: 60 }, () => "$$x$$").join("\n"),
  );
});

Given(
  "文字数上限を超える表示数式を含む収容可能なコーパスがある",
  function (this: StepWorld) {
    const tooLong = `x=${"x".repeat(16_383)}`;
    createPlanCorpus(
      this,
      "long-typesetting-failure.md",
      ["$$x$$", `$$${tooLong}$$`].join("\n\n"),
    );
  },
);

When("実表示検証の表示計画境界を実行する", function (this: StepWorld) {
  runPlanBoundary(this, "verify-display-plan.js");
});

When("表示数式の画像行数を含む出力高を計画する", function (this: StepWorld) {
  runPlanBoundary(this, "plan-display.js");
});

When("テキスト経路の表示計画境界を実行する", function (this: StepWorld) {
  runPlanBoundary(this, "verify-display-plan.js", "--path", "text");
});

When(
  "100 列とテキスト経路の表示計画境界を実行する",
  function (this: StepWorld) {
    runPlanBoundary(
      this,
      "verify-display-plan.js",
      "--path",
      "text",
      "--reflow",
      "100",
    );
  },
);

When("100 列と画像経路の表示計画境界を実行する", function (this: StepWorld) {
  runPlanBoundary(this, "verify-display-plan.js", "--reflow", "100");
});

Then("100列へのテキスト表示計画は正常終了する", function (this: StepWorld) {
  assert.deepEqual(this.planResult.status, 0);
});

Then("100列へのリフローを含む計画高は8856pxである", function (this: StepWorld) {
  const plan = JSON.parse(this.planResult.stdout);
  assert.deepEqual(plan.height, 8856);
});

Then("リフロー前の計画幅は1920pxである", function (this: StepWorld) {
  const plan = JSON.parse(this.planResult.stdout);
  assert.deepEqual(plan.initialWidth, 1920);
});

Then("100列へのリフロー後の計画幅は816pxである", function (this: StepWorld) {
  const plan = JSON.parse(this.planResult.stdout);
  assert.deepEqual(plan.reflowWidth, 816);
});

Then(
  "リフロー後に収まらない表示計画は終了コード2を返す",
  function (this: StepWorld) {
    assert.deepEqual(this.planResult.status, 2);
  },
);

Then("高さ超過の診断にテキスト経路が示される", function (this: StepWorld) {
  assert.deepEqual(/テキスト経路/u.test(this.planResult.stderr), true);
});

Then("高さ超過の診断に100列へのリフローが示される", function (this: StepWorld) {
  assert.deepEqual(/100列へのリフロー後/u.test(this.planResult.stderr), true);
});

Then("高さ超過の診断に必要な高さ16056pxが示される", function (this: StepWorld) {
  assert.deepEqual(/16056px/u.test(this.planResult.stderr), true);
});

Then("表示計画は Markdown 表の折り返しを含む", function (this: StepWorld) {
  assert.equal(JSON.parse(this.planResult.stdout).height, 9000);
});

Then(
  "読めない縮尺の数式を含む表示計画は正常終了する",
  function (this: StepWorld) {
    assert.deepEqual(this.planResult.status, 0);
  },
);

Then(
  "読めない縮尺の数式が組版失敗1件として計画される",
  function (this: StepWorld) {
    assert.deepEqual(JSON.parse(this.planResult.stdout).failedFormulas, 1);
  },
);

Then(
  "読めない縮尺の数式の組版失敗1件が診断に示される",
  function (this: StepWorld) {
    assert.deepEqual(
      /組版に失敗した表示数式: 1/u.test(this.planResult.stderr),
      true,
    );
  },
);

Then(
  "画像転送行で高さを超えた表示計画は終了コード2を返す",
  function (this: StepWorld) {
    assert.deepEqual(this.planResult.status, 2);
  },
);

Then("転送行の高さ超過の診断に画像経路が示される", function (this: StepWorld) {
  assert.deepEqual(/画像経路/u.test(this.planResult.stderr), true);
});

Then(
  "転送行の高さ超過の診断に16000px上限が示される",
  function (this: StepWorld) {
    assert.deepEqual(/16000px/u.test(this.planResult.stderr), true);
  },
);

Then("テキスト経路の表示計画は正常終了する", function (this: StepWorld) {
  assert.deepEqual(this.planResult.status, 0);
});

Then("テキスト経路の表示計画に画像行は含まれない", function (this: StepWorld) {
  const plan = JSON.parse(this.planResult.stdout);
  assert.deepEqual(plan.imageRows, 0);
});

Then(
  "テキスト経路の表示計画に画像組版失敗は含まれない",
  function (this: StepWorld) {
    const plan = JSON.parse(this.planResult.stdout);
    assert.deepEqual(plan.failedFormulas, 0);
  },
);

Then("組版失敗を含む検証用表示計画は正常終了する", function (this: StepWorld) {
  assert.deepEqual(this.planResult.status, 0);
});

Then("検証用表示計画は組版失敗を1件数える", function (this: StepWorld) {
  assert.deepEqual(JSON.parse(this.planResult.stdout).failedFormulas, 1);
});

Then("検証用表示計画の診断に組版失敗1件が示される", function (this: StepWorld) {
  assert.deepEqual(
    /組版に失敗した表示数式: 1/u.test(this.planResult.stderr),
    true,
  );
});

Then("画像行のない検証用表示計画は正常終了する", function (this: StepWorld) {
  assert.deepEqual(this.planResult.status, 0);
});

Then(
  "全数式の組版失敗後もテキスト用の表示計画が返る",
  function (this: StepWorld) {
    assert.deepEqual(JSON.parse(this.planResult.stdout), {
      height: 8000,
      initialWidth: 1920,
      reflowWidth: null,
      imageRows: 0,
      displayFormulas: 1,
      failedFormulas: 1,
    });
  },
);

Then("全数式の組版失敗後も失敗1件が診断に示される", function (this: StepWorld) {
  assert.deepEqual(
    /組版に失敗した表示数式: 1/u.test(this.planResult.stderr),
    true,
  );
});

Then(
  "読めないコーパスの表示計画は終了コード2を返す",
  function (this: StepWorld) {
    assert.deepEqual(this.planResult.status, 2);
  },
);

Then(
  "表示計画の診断に読めないコーパスのファイル名が示される",
  function (this: StepWorld) {
    assert.deepEqual(/missing\.md/u.test(this.planResult.stderr), true);
  },
);

Then("読取失敗の診断に高さ超過は示されない", function (this: StepWorld) {
  assert.deepEqual(/16000px/u.test(this.planResult.stderr), false);
});

Then("組版失敗を含む出力高の計画は正常終了する", function (this: StepWorld) {
  assert.deepEqual(this.planResult.status, 0);
});

Then("組版失敗と残りの画像行を含む表示計画が返る", function (this: StepWorld) {
  assert.deepEqual(JSON.parse(this.planResult.stdout), {
    height: 8000,
    initialWidth: 1920,
    reflowWidth: null,
    imageRows: 1,
    displayFormulas: 2,
    failedFormulas: 1,
  });
});

Then(
  "入力文字数上限による失敗を含む表示計画は正常終了する",
  function (this: StepWorld) {
    assert.deepEqual(this.planResult.status, 0);
  },
);

Then(
  "長い数式をテキストとして一度だけ数えた表示計画が返る",
  function (this: StepWorld) {
    assert.deepEqual(JSON.parse(this.planResult.stdout), {
      height: 9856,
      initialWidth: 1920,
      reflowWidth: null,
      imageRows: 1,
      displayFormulas: 2,
      failedFormulas: 1,
    });
  },
);

Given(
  "16000px を超える高い表示数式を含む短いコーパスがある",
  function (this: StepWorld) {
    createPlanCorpus(
      this,
      "tall.md",
      ["$$\\rule{1em}{300ex}$$", "$$\\rule{1em}{300ex}$$"].join("\n\n"),
    );
  },
);

Then(
  "高い表示数式の計画は描画前に終了コード2を返す",
  function (this: StepWorld) {
    assert.deepEqual(this.planResult.status, 2);
  },
);

Then("高い表示数式の診断に16000px上限が示される", function (this: StepWorld) {
  assert.deepEqual(/16000px/u.test(this.planResult.stderr), true);
});

Then("高い表示数式の診断に読取失敗は示されない", function (this: StepWorld) {
  assert.deepEqual(/missing\.md/u.test(this.planResult.stderr), false);
});
