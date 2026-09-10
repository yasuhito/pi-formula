const assert = require("node:assert/strict");
const test = require("node:test");

const {
  probePngSupport,
  queryTerminalForeground,
} = require("../dist/terminal-probe.js");
const { decodePng } = require("../scripts/detect-display-bands.js");

function terminalQueryHarness(queryTerminal) {
  let listener;
  let query;
  const result = queryTerminal({
    addInputListener(value) {
      listener = value;
      return () => {
        listener = undefined;
      };
    },
    terminal: {
      write(value) {
        query = value;
      },
    },
  });
  return {
    query,
    input(data) {
      return listener(data);
    },
    result,
  };
}

function probeHarness() {
  const harness = terminalQueryHarness(probePngSupport);
  return {
    ...harness,
    imageId: /i=(\d+)/u.exec(harness.query)[1],
  };
}

function foregroundHarness() {
  return terminalQueryHarness(queryTerminalForeground);
}

function returnedInput(results) {
  return results
    .map((result) => (result && "data" in result ? result.data : ""))
    .join("");
}

test("the terminal foreground query returns an exact RGB color", async () => {
  const probe = foregroundHarness();
  probe.input("\x1b]10;rgb:d4d4/d4d4/d4d4\x1b\\");

  assert.equal(await probe.result, "#d4d4d4");
});

for (const responseValue of ["OK", "EINVAL"]) {
  const responseKind = responseValue === "OK" ? "successful" : "rejected";
  test(`a ${responseKind} PNG response is recognized across every byte boundary`, async () => {
    const expectedPath = responseValue === "OK" ? "image" : "text";
    const actual = [];
    const expected = [];
    for (let split = 1; ; split += 1) {
      const probe = probeHarness();
      const response = `\x1b_Gi=${probe.imageId};${responseValue}\x1b\\`;
      if (split >= response.length) break;
      const handled = [
        probe.input(`typed-before${response.slice(0, split)}`),
        probe.input(`${response.slice(split)}typed-after`),
      ];

      actual.push({
        split,
        path: (await probe.result).path,
        returnedInput: returnedInput(handled),
        returnedControls: returnedInput(handled).includes("\x1b"),
      });
      expected.push({
        split,
        path: expectedPath,
        returnedInput: "typed-beforetyped-after",
        returnedControls: false,
      });
    }

    assert.deepEqual(actual, expected);
  });
}

test("the PNG query contains strictly decodable image data", () => {
  const probe = probeHarness();
  const payload = /;([^;]+)\x1b\\$/u.exec(probe.query)?.[1] ?? "";

  assert.doesNotThrow(() => decodePng(Buffer.from(payload, "base64")));
});

test("a partial PNG prefix returns preceding user input before timing out", async () => {
  const keepEventLoopAlive = setTimeout(() => {}, 1000);
  try {
    const probe = probeHarness();
    const handled = probe.input("typed-before\x1b");

    assert.deepEqual(
      { handled, probe: await probe.result },
      {
        handled: { data: "typed-before" },
        probe: {
          path: "text",
          reason: "PNG query timed out",
          response: "timeout",
        },
      },
    );
  } finally {
    clearTimeout(keepEventLoopAlive);
  }
});
