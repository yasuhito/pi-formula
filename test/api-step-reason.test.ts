import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test, { type TestContext } from "node:test";

const root = resolve(__dirname, "..");
const feature = `# Feature: PNG result observation
## Scenario: Successful prebuilt PNG rendering has no rejection reason
- Given a test integration extension uses the image path
- When render a prebuilt PNG Buffer through the public API
- Then Successful prebuilt PNG rendering has no rejection reason
`;
const mutation = `
const Module = require("node:module");
const original = Module._load;
Module._load = function (request, ...args) {
  const value = original.call(this, request, ...args);
  if (typeof request !== "string" || !request.endsWith("/dist/api.js") ||
      typeof value?.renderPng !== "function") return value;
  return { ...value, renderPng(...parameters) {
    const result = value.renderPng(...parameters);
    return result.rendered
      ? { ...result, reason: "unexpected successful-result reason" }
      : result;
  } };
};
`;

function runReasonScenario(t: TestContext, mutate: boolean) {
  const directory = mkdtempSync(join(tmpdir(), "pi-formula-step-reason-"));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const scenario = join(directory, "reason.feature.md");
  const preload = join(directory, "mutation.cjs");
  writeFileSync(scenario, feature);
  writeFileSync(preload, mutation);
  const result = spawnSync(
    process.execPath,
    [
      ...(mutate ? ["--require", preload] : []),
      join(root, "node_modules/@cucumber/cucumber/bin/cucumber.js"),
      "--require",
      join(root, "features/step_definitions/api_steps.ts"),
      "--format",
      "json",
      scenario,
    ],
    { cwd: root, encoding: "utf8", timeout: 30_000 },
  );
  if (result.error) throw result.error;
  return result;
}

test("PNG reason step accepts the real successful API result", (t) => {
  const result = runReasonScenario(t, false);
  assert.equal(result.status, 0, result.stderr || result.stdout);
});

test("PNG reason step rejects an extra reason on a successful API result", (t) => {
  const result = runReasonScenario(t, true);
  assert.equal(result.status, 1, result.stderr || result.stdout);
});
