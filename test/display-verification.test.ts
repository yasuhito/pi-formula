import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

const {
  displayVerificationExitCode,
  verifyDisplayArguments,
}: typeof import("../dist/display-verification.js") = require("../dist/display-verification.js");

import { createDisplayVerificationFixture } from "./support/display-verification-fixture.js";

const fixture = createDisplayVerificationFixture;

async function withFixture<T>(
  overrides: Parameters<typeof fixture>[0],
  adapterOptions: Parameters<typeof fixture>[1],
  inspect: (
    result: Awaited<ReturnType<ReturnType<typeof fixture>["run"]>>,
    subject: ReturnType<typeof fixture>,
  ) => T,
) {
  const subject = fixture(overrides, adapterOptions);
  try {
    return inspect(await subject.run(), subject);
  } finally {
    subject.cleanup();
  }
}

test("real-display verification returns an initial capture for visual inspection", async () => {
  const exists = await withFixture({}, {}, (result) =>
    result.kind === "captured" ? fs.existsSync(result.captures[0]) : false,
  );
  assert.equal(exists, true);
});

test("reflow preserves captures before and after the change", async () => {
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

test("a response differing from the corpus fails at verify-response", async () => {
  const stage = await withFixture({}, { response: "$$y$$\n" }, (result) =>
    result.kind === "failed" ? result.stage : undefined,
  );
  assert.equal(stage, "verify-response");
});

test("capture dimensions differing from the plan fail at capture", async () => {
  const stage = await withFixture({}, { wrongDimensions: true }, (result) =>
    result.kind === "failed" ? result.stage : undefined,
  );
  assert.equal(stage, "capture");
});

test("an unstable capture does not produce a captured result", async () => {
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

test("a non-PNG capture fails at capture", async () => {
  const stage = await withFixture({}, { invalidPng: true }, (result) =>
    result.kind === "failed" ? result.stage : undefined,
  );
  assert.equal(stage, "capture");
});

test("a truncated PNG capture fails at capture", async () => {
  const stage = await withFixture({}, { truncatedPng: true }, (result) =>
    result.kind === "failed" ? result.stage : undefined,
  );
  assert.equal(stage, "capture");
});

test("the text path can be selected for capture", async () => {
  const kind = await withFixture(
    { path: "text" },
    { selectedPath: "text" },
    (result) => result.kind,
  );
  assert.equal(kind, "captured");
});

test("all three protocol checks run", async () => {
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

test("CLI options are passed to real-display verification conditions", async () => {
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

test("failure to start the verification session fails at launch", async () => {
  const stage = await withFixture(
    {},
    { spawnError: "cannot spawn" },
    (result) => (result.kind === "failed" ? result.stage : undefined),
  );
  assert.equal(stage, "launch");
});

test("a capture timeout still stops the verification session", async () => {
  const stopped = await withFixture(
    {},
    { captureTimeout: true },
    (_result, subject) => subject.processAdapter.terminated,
  );
  assert.equal(stopped, true);
});

test("aborting still stops the verification session", async () => {
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

test("failure still stops the verification session", async () => {
  const terminated = await withFixture(
    {},
    { response: "different" },
    (_result, subject) => subject.processAdapter.terminated,
  );
  assert.equal(terminated, true);
});

test("a cleanup-only failure returns a cleanup failure", async () => {
  const stage = await withFixture(
    {},
    { cleanupDiagnostics: ["still running"] },
    (result) => (result.kind === "failed" ? result.stage : undefined),
  );
  assert.equal(stage, "cleanup");
});

test("real-display verification finishes without waiting for completion when cleanup throws", async () => {
  const subject = fixture({}, { terminationError: "cannot stop" });
  try {
    const result = await subject.run();
    assert.deepEqual(
      {
        stage: result.kind === "failed" ? result.stage : result.kind,
        completionObservations: subject.processAdapter.completionObservations,
      },
      { stage: "cleanup", completionObservations: 1 },
    );
  } finally {
    subject.cleanup();
  }
});

test("failure to write diagnostic artifacts still returns a cleanup failure", async () => {
  const kind = await withFixture({}, { blockCageLog: true }, (result) =>
    result.kind === "failed" ? result.stage : result.kind,
  );
  assert.equal(kind, "cleanup");
});

test("failure to write result artifacts still returns a cleanup failure", async () => {
  const kind = await withFixture({}, { blockResult: true }, (result) =>
    result.kind === "failed" ? result.stage : result.kind,
  );
  assert.equal(kind, "cleanup");
});

test("cleanup diagnostics do not replace an earlier failure", async () => {
  const stage = await withFixture(
    {},
    { response: "different", cleanupDiagnostics: ["still running"] },
    (result) => (result.kind === "failed" ? result.stage : undefined),
  );
  assert.equal(stage, "verify-response");
});

test("display plan rejection returns an artifact directory", async () => {
  const directory = await withFixture(
    {},
    {
      planFailure: {
        status: 2,
        stdout: "",
        stderr: "does not fit within 16000px",
        timedOut: false,
      },
    },
    (result) =>
      result.kind === "rejected" ? result.artifactDirectory : undefined,
  );
  assert.equal(typeof directory, "string");
});

test("specifying a directory as the corpus rejects the input", async () => {
  const subject = fixture({ corpus: undefined });
  subject.options.corpus = subject.directory;
  subject.processAdapter.options.corpus = subject.directory;
  try {
    assert.equal((await subject.run()).kind, "rejected");
  } finally {
    subject.cleanup();
  }
});

test("an unreadable corpus returns an input rejection", async () => {
  const subject = fixture();
  try {
    fs.rmSync(path.join(subject.directory, "corpus.md"));
    assert.equal((await subject.run()).kind, "rejected");
  } finally {
    subject.cleanup();
  }
});

test("a platform failure also returns an artifact directory", async () => {
  const subject = fixture();
  try {
    const result = await subject.run({ platform: "darwin" });
    assert.equal(typeof result.artifactDirectory, "string");
  } finally {
    subject.cleanup();
  }
});

test("a reflow value that is not a safe integer is rejected", async () => {
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

test("argument rejection also returns an artifact directory", async () => {
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

test("a captured result maps to exit code 0", () => {
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
