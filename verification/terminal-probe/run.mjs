import assert from "node:assert/strict";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { check, formatValue } from "tla-ts";

const output = new URL("output/", import.meta.url);
mkdirSync(output, { recursive: true });
const prefix = "\x1b_Gi=1900000000;";
const ending = "\x1b\\";
const bytes = (value) => Array.from(value, (c) => c.charCodeAt(0));
const seq = (value) => `<<${bytes(value).join(",")}>>`;
const cases = [];
for (const payload of ["OK", "EINVAL"]) {
  for (const before of ["u", "u\x1bv"]) {
    const frame = prefix + payload + ending;
    cases.push({
      wire: `${before}${frame}v`,
      user: `${before}v`,
      path: payload === "OK" ? "image" : "text",
      start: before.length + 1,
      finish: before.length + frame.length,
    });
  }
}
for (const wire of [
  "u\x1b",
  "u\x1b_",
  "u\x1bv",
  "u\x1b_Gi=1900000001;OK\x1b\\v",
]) {
  cases.push({
    wire,
    user: wire,
    path: "pending",
    start: wire.length + 1,
    finish: wire.length + 1,
  });
}
const records = cases.map(
  (c) =>
    `[wire |-> ${seq(c.wire)}, user |-> ${seq(c.user)}, path |-> "${c.path}", start |-> ${c.start}, finish |-> ${c.finish}]`,
);
const source = readFileSync(new URL("Probe.tla", import.meta.url), "utf8")
  .replace("MODULE Probe", "MODULE ProbeModel")
  .replace(
    "CONSTANTS Prefix, Ending, Cases, Mutate",
    `CONSTANT Mutate\nPrefix == ${seq(prefix)}\nEnding == ${seq(ending)}\nCases == {${records.join(",\n")}}`,
  );
writeFileSync(new URL("ProbeModel.tla", output), source);
const base = `SPECIFICATION Spec\nCHECK_DEADLOCK FALSE\nINVARIANT SettlesOnce\nINVARIANT ListenerReleased\nINVARIANT CompleteInput\nINVARIANT NoPrematureSuccess\nINVARIANT UnmatchedInput\nINVARIANT TimeoutBeforeFrame\nINVARIANT TimeoutInFrame\nINVARIANT TimeoutTail\nPROPERTY EventuallySettled\n`;
writeFileSync(new URL("cases.json", output), JSON.stringify(cases, null, 2));
for (const label of ["current", "mutated", "mutated-response"]) {
  const mutate = label !== "current";
  const selected =
    label === "mutated-response"
      ? base.replace(/INVARIANT Timeout[^\n]+\n/g, "")
      : base;
  const config = `${selected}CONSTANT Mutate = ${mutate ? "TRUE" : "FALSE"}\n`;
  writeFileSync(new URL(`${label}.cfg`, output), config);
  const started = performance.now();
  try {
    const result = await check({ source, config });
    const report = {
      label,
      status: result.status,
      failure: result.failure?.message,
      generatedStates: result.generatedStates,
      distinctStates: result.distinctStates,
      depth: result.depth,
      ms: Math.round(performance.now() - started),
      violation: result.violation && {
        ...result.violation,
        trace: result.violation.trace?.map((step) => ({
          action: step.action,
          label: step.label,
          state: Object.fromEntries(
            Object.entries(step.state).map(([key, value]) => [
              key,
              formatValue(value),
            ]),
          ),
        })),
      },
    };
    writeFileSync(
      new URL(`${label}.json`, output),
      JSON.stringify(report, null, 2),
    );
    console.log(JSON.stringify(report, null, 2));
    assert.equal(result.status, mutate ? "invariant-violation" : "success");
    if (label === "mutated")
      assert.equal(result.violation?.name, "TimeoutBeforeFrame");
    if (label === "mutated-response")
      assert.equal(result.violation?.name, "CompleteInput");
  } catch (error) {
    console.error(label, error);
    process.exitCode = 1;
  }
}
