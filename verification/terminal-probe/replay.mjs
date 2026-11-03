import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";
import { stripTypeScriptTypes } from "node:module";
import { resolve } from "node:path";
import { mock } from "node:test";

const output = new URL("output/", import.meta.url);
const sourcePath =
  process.env.PROBE_SOURCE === undefined
    ? new URL("../../src/terminal-probe.ts", import.meta.url)
    : resolve(process.env.PROBE_SOURCE);
const source = stripTypeScriptTypes(readFileSync(sourcePath, "utf8"));
const moduleUrl = `data:text/javascript;base64,${Buffer.from(source).toString("base64")}`;
let modules = 0;
mock.timers.enable({ apis: ["setTimeout"] });
const cases = JSON.parse(readFileSync(new URL("cases.json", output)));
const trace = JSON.parse(readFileSync(new URL("mutated-response.json", output)))
  .violation.trace;
const fromSeq = (text) =>
  String.fromCharCode(...(text.match(/\d+/g) ?? []).map(Number));
const traceWire = fromSeq(/wire \|-> (<<[^>]*>>)/.exec(trace[0].state.case)[1]);
const traceCase = cases.find((c) => c.wire === traceWire);
const stops = trace
  .filter((s) => s.action === "Input")
  .map((s) => Number(s.state.cursor));

async function replay(c, boundaries, timeoutAt) {
  const { probePngSupport } = await import(`${moduleUrl}#${modules++}`);
  let listener;
  let query;
  let removed = 0;
  let output = "";
  let path = "pending";
  const promise = probePngSupport({
    addInputListener(value) {
      listener = value;
      return () => {
        listener = undefined;
        removed++;
      };
    },
    terminal: {
      write(value) {
        query = value;
      },
    },
  }).then((value) => {
    path = value.path;
    return value;
  });
  const id = /i=(\d+)/.exec(query)[1];
  assert.equal(id, "1900000000");
  const wire = c.wire;
  let cursor = 0;
  for (const stop of boundaries) {
    if (timeoutAt === cursor) {
      mock.timers.tick(300);
      await Promise.resolve();
    }
    const data = wire.slice(cursor, stop);
    const handled = listener?.(data);
    output +=
      handled && "data" in handled
        ? handled.data
        : handled?.consume
          ? ""
          : data;
    cursor = stop;
  }
  if (timeoutAt === cursor) {
    mock.timers.tick(300);
    await Promise.resolve();
  }
  await Promise.resolve();
  const observed = { path, output, removed, listener: Boolean(listener) };
  mock.timers.tick(300);
  await promise;
  return observed;
}
const report = { counterexample: { wire: traceWire, stops }, checks: {} };
const counterexampleResult = await replay(traceCase, stops);
console.log(JSON.stringify({ counterexampleResult }));
assert.equal(counterexampleResult.path, traceCase.path);
report.checks.counterexamplePath = counterexampleResult.path;
assert.equal(counterexampleResult.output, traceCase.user);
report.checks.counterexampleInput = counterexampleResult.output;
assert.equal(counterexampleResult.removed, 1);
report.checks.unsubscribe = counterexampleResult.removed;
assert.equal(counterexampleResult.listener, false);
report.checks.listener = counterexampleResult.listener;
let partitionRuns = 0;
for (const c of cases.filter((c) => c.path !== "pending")) {
  for (let a = 1; a < c.wire.length; a++) {
    for (let b = a + 1; b < c.wire.length; b++) {
      const result = await replay(c, [a, b, c.wire.length]);
      assert.equal(result.path, c.path);
      assert.equal(result.output, c.user);
      partitionRuns++;
    }
  }
}
report.threeChunkPartitionRuns = partitionRuns;
let timeoutRuns = 0;
for (const c of cases) {
  const before = [];
  for (let n = 0; n <= c.wire.length; n++) {
    const consumed = c.wire.slice(0, n);
    const prefix = "\x1b_Gi=1900000000;";
    const frameStarted = c.start <= n;
    if (c.path !== "pending" && n >= c.finish) continue;
    let expectedBefore = consumed;
    if (frameStarted) expectedBefore = c.wire.slice(0, c.start - 1);
    else {
      for (let k = Math.min(consumed.length, prefix.length - 1); k > 0; k--) {
        if (prefix.startsWith(consumed.slice(-k))) {
          expectedBefore = consumed.slice(0, -k);
          break;
        }
      }
    }
    const boundaries =
      n === 0
        ? [c.wire.length]
        : n === c.wire.length
          ? [n]
          : [n, c.wire.length];
    const result = await replay(c, boundaries, n);
    assert.equal(result.path, "text");
    before.push({
      n,
      output: result.output,
      expected: expectedBefore + c.wire.slice(n),
    });
    timeoutRuns++;
  }
  for (const item of before)
    assert.equal(item.output, item.expected, `timeout at ${item.n}`);
}
report.timeoutRuns = timeoutRuns;
mock.timers.reset();
writeFileSync(new URL("replay.json", output), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
