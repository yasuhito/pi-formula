const assert = require("node:assert/strict");
const test = require("node:test");

const { probePngSupport } = require("../dist/terminal-probe.js");

function probeHarness() {
  let listener;
  let query;
  const result = probePngSupport({
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
  const imageId = /i=(\d+)/u.exec(query)[1];
  return {
    imageId,
    input(data) {
      return listener(data);
    },
    result,
  };
}

function returnedInput(results) {
  return results
    .map((result) => (result && "data" in result ? result.data : ""))
    .join("");
}

for (const responseValue of ["OK", "EINVAL"]) {
  const responseKind = responseValue === "OK" ? "successful" : "rejected";
  test(`a ${responseKind} PNG response is recognized across every byte boundary`, async () => {
    const expectedPath = responseValue === "OK" ? "image" : "text";
    for (let split = 1; ; split += 1) {
      const probe = probeHarness();
      const response = `\x1b_Gi=${probe.imageId};${responseValue}\x1b\\`;
      if (split >= response.length) break;
      const handled = [
        probe.input(`typed-before${response.slice(0, split)}`),
        probe.input(`${response.slice(split)}typed-after`),
      ];

      assert.deepEqual(
        {
          path: (await probe.result).path,
          returnedInput: returnedInput(handled),
          returnedControls: returnedInput(handled).includes("\x1b"),
        },
        {
          path: expectedPath,
          returnedInput: "typed-beforetyped-after",
          returnedControls: false,
        },
      );
    }
  });
}

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
