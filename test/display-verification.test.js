const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const {
  displayVerificationExitCode,
  verifyDisplayArguments,
} = require("../dist/display-verification.js");
const {
  createDisplayVerificationFixture,
} = require("./support/display-verification-fixture.js");

const fixture = createDisplayVerificationFixture;

async function withFixture(overrides, adapterOptions, inspect) {
  const subject = fixture(overrides, adapterOptions);
  try {
    return inspect(await subject.run(), subject);
  } finally {
    subject.cleanup();
  }
}

test("実表示検証は目視確認用の初期キャプチャを返す", async () => {
  const exists = await withFixture({}, {}, (result) =>
    result.kind === "captured" ? fs.existsSync(result.captures[0]) : false,
  );
  assert.equal(exists, true);
});

test("描き直しでは変更前後のキャプチャを残す", async () => {
  const count = await withFixture(
    { reflow: 100 },
    {
      plan: {
        height: 80,
        initialWidth: 120,
        reflowWidth: 80,
        imageRows: 1,
        displayFormulas: 1,
        failedFormulas: 0,
      },
    },
    (result) => (result.kind === "captured" ? result.captures.length : 0),
  );
  assert.equal(count, 2);
});

test("コーパスと異なる応答はverify-responseで失敗する", async () => {
  const stage = await withFixture({}, { response: "$$y$$\n" }, (result) =>
    result.kind === "failed" ? result.stage : undefined,
  );
  assert.equal(stage, "verify-response");
});

test("計画と異なる寸法のキャプチャはcaptureで失敗する", async () => {
  const stage = await withFixture({}, { wrongDimensions: true }, (result) =>
    result.kind === "failed" ? result.stage : undefined,
  );
  assert.equal(stage, "capture");
});

test("安定しないキャプチャはcapturedにならない", async () => {
  const subject = fixture({}, { unstable: true });
  const controller = new AbortController();
  setTimeout(() => controller.abort(), 10);
  try {
    const result = await verifyDisplayArguments(
      [
        "--extension",
        subject.options.extension,
        "--artifacts",
        subject.options.artifactsRoot,
        subject.options.corpus,
      ],
      {
        process: subject.processAdapter,
        rootDirectory: path.resolve(__dirname, ".."),
        platform: "linux",
        pollIntervalMs: 1,
      },
      controller.signal,
    );
    assert.notEqual(result.kind, "captured");
  } finally {
    subject.cleanup();
  }
});

test("PNGでないキャプチャはcaptureで失敗する", async () => {
  const stage = await withFixture({}, { invalidPng: true }, (result) =>
    result.kind === "failed" ? result.stage : undefined,
  );
  assert.equal(stage, "capture");
});

test("途中で切れたPNGキャプチャはcaptureで失敗する", async () => {
  const stage = await withFixture({}, { truncatedPng: true }, (result) =>
    result.kind === "failed" ? result.stage : undefined,
  );
  assert.equal(stage, "capture");
});

test("テキスト経路を選んでキャプチャできる", async () => {
  const kind = await withFixture(
    { path: "text" },
    { selectedPath: "text" },
    (result) => result.kind,
  );
  assert.equal(kind, "captured");
});

test("protocol検査を三つとも実行する", async () => {
  const count = await withFixture(
    {},
    {},
    (_result, subject) =>
      subject.processAdapter.requests.filter(
        (request) => request.operation === "protocol",
      ).length,
  );
  assert.equal(count, 3);
});

test("CLI optionsを実表示検証の実行条件へ渡す", async () => {
  const subject = fixture({}, { selectedPath: "text" });
  try {
    const result = await verifyDisplayArguments(
      [
        "--theme",
        "dark",
        "--terminal",
        "kitty",
        "--path",
        "text",
        "--reflow",
        "100",
        "--extension",
        subject.options.extension,
        "--artifacts",
        subject.options.artifactsRoot,
        subject.options.corpus,
      ],
      {
        process: subject.processAdapter,
        rootDirectory: path.resolve(__dirname, ".."),
        platform: "linux",
        pollIntervalMs: 1,
      },
    );
    assert.deepEqual(result.kind === "captured" ? result.conditions : null, {
      theme: "dark",
      terminal: "kitty",
      path: "text",
      reflow: 100,
      extension: subject.options.extension,
    });
  } finally {
    subject.cleanup();
  }
});

test("検証セッションを起動できない場合はlaunchで失敗する", async () => {
  const stage = await withFixture(
    {},
    { spawnError: "cannot spawn" },
    (result) => (result.kind === "failed" ? result.stage : undefined),
  );
  assert.equal(stage, "launch");
});

test("capture timeoutでも検証セッションを停止する", async () => {
  const stopped = await withFixture(
    {},
    { captureTimeout: true },
    (_result, subject) => subject.processAdapter.terminated,
  );
  assert.equal(stopped, true);
});

test("中断時も検証セッションを停止する", async () => {
  const subject = fixture({}, { unstable: true });
  const controller = new AbortController();
  setTimeout(() => controller.abort(), 10);
  try {
    await verifyDisplayArguments(
      [
        "--extension",
        subject.options.extension,
        "--artifacts",
        subject.options.artifactsRoot,
        subject.options.corpus,
      ],
      {
        process: subject.processAdapter,
        rootDirectory: path.resolve(__dirname, ".."),
        platform: "linux",
        pollIntervalMs: 1,
      },
      controller.signal,
    );
    assert.equal(subject.processAdapter.terminated, true);
  } finally {
    subject.cleanup();
  }
});

test("失敗時も検証セッションを停止する", async () => {
  const terminated = await withFixture(
    {},
    { response: "different" },
    (_result, subject) => subject.processAdapter.terminated,
  );
  assert.equal(terminated, true);
});

test("cleanupだけが失敗した場合はcleanup failureを返す", async () => {
  const stage = await withFixture(
    {},
    { cleanupDiagnostics: ["still running"] },
    (result) => (result.kind === "failed" ? result.stage : undefined),
  );
  assert.equal(stage, "cleanup");
});

test("cleanupが例外を返しても実表示検証は完了する", async () => {
  const subject = fixture({}, { terminationError: "cannot stop" });
  try {
    const outcome = await Promise.race([
      subject
        .run()
        .then((result) =>
          result.kind === "failed" ? result.stage : result.kind,
        ),
      new Promise((resolve) => setTimeout(() => resolve("timeout"), 100)),
    ]);
    assert.equal(outcome, "cleanup");
  } finally {
    subject.cleanup();
  }
});

test("診断artifactを書けなくてもcleanup failureを返す", async () => {
  const kind = await withFixture({}, { blockCageLog: true }, (result) =>
    result.kind === "failed" ? result.stage : result.kind,
  );
  assert.equal(kind, "cleanup");
});

test("結果artifactを書けなくてもcleanup failureを返す", async () => {
  const kind = await withFixture({}, { blockResult: true }, (result) =>
    result.kind === "failed" ? result.stage : result.kind,
  );
  assert.equal(kind, "cleanup");
});

test("先行する失敗はcleanup診断で置き換えない", async () => {
  const stage = await withFixture(
    {},
    { response: "different", cleanupDiagnostics: ["still running"] },
    (result) => (result.kind === "failed" ? result.stage : undefined),
  );
  assert.equal(stage, "verify-response");
});

test("表示計画による拒否はartifact directoryを返す", async () => {
  const directory = await withFixture(
    {},
    {
      planFailure: {
        status: 2,
        stdout: "",
        stderr: "16000px に収まりません",
        timedOut: false,
      },
    },
    (result) =>
      result.kind === "rejected" ? result.artifactDirectory : undefined,
  );
  assert.equal(typeof directory, "string");
});

test("directoryをコーパスとして指定すると入力拒否になる", async () => {
  const subject = fixture({ corpus: undefined });
  subject.options.corpus = subject.directory;
  subject.processAdapter.options.corpus = subject.directory;
  try {
    assert.equal((await subject.run()).kind, "rejected");
  } finally {
    subject.cleanup();
  }
});

test("読めないコーパスは入力拒否として返す", async () => {
  const subject = fixture();
  try {
    fs.rmSync(path.join(subject.directory, "corpus.md"));
    assert.equal((await subject.run()).kind, "rejected");
  } finally {
    subject.cleanup();
  }
});

test("platform failureもartifact directoryを返す", async () => {
  const subject = fixture();
  try {
    const result = await subject.run({ platform: "darwin" });
    assert.equal(typeof result.artifactDirectory, "string");
  } finally {
    subject.cleanup();
  }
});

test("安全な整数でないreflowを入力拒否する", async () => {
  const directory = fs.mkdtempSync(
    path.join(os.tmpdir(), "pi-formula-display-reflow-"),
  );
  try {
    const result = await verifyDisplayArguments(
      ["--reflow", "999999999999999999999999"],
      { env: { XDG_STATE_HOME: directory } },
    );
    assert.equal(result.kind, "rejected");
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

test("引数拒否もartifact directoryを返す", async () => {
  const directory = fs.mkdtempSync(
    path.join(os.tmpdir(), "pi-formula-display-arguments-"),
  );
  try {
    const result = await verifyDisplayArguments([], {
      env: { XDG_STATE_HOME: directory },
    });
    assert.equal(typeof result.artifactDirectory, "string");
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

test("capturedは終了コード0になる", () => {
  assert.equal(
    displayVerificationExitCode({
      kind: "captured",
      artifactDirectory: "/tmp/run",
      captures: ["/tmp/run/initial.png"],
      protocolChecks: [],
      conditions: {
        theme: "light",
        terminal: "ghostty",
        path: "image",
        reflow: null,
        extension: "/tmp/extension.ts",
      },
    }),
    0,
  );
});
