const assert = require("node:assert/strict");
const test = require("node:test");

const {
  monitorId,
  verifyPngDimensions,
} = require("../scripts/verify-display-dimensions");
const { createPng } = require("./support/png-fixture");

test("計画より短い headless monitor を拒否する", () => {
  assert.throws(
    () =>
      monitorId(
        [
          {
            id: 42,
            name: "pf-test",
            disabled: false,
            width: 1920,
            height: 3999,
          },
        ],
        "pf-test",
        1920,
        4000,
      ),
    /1920x4000/u,
  );
});

test("計画より短い PNG キャプチャを拒否する", () => {
  const png = createPng(120, 79, () => [250, 248, 240]);
  assert.throws(() => verifyPngDimensions(png, 120, 80), /120x80/u);
});
