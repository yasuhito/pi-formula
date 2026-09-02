const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const { waitForMarker } = require("../scripts/wait-for-marker");

test("ACK待ちの開始後に撮影解除markerが現れたら待機を終了する", async (t) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "wait-for-marker-"));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const acknowledgement = path.join(directory, "acknowledgement");
  const cancellation = path.join(directory, "cancellation");
  const waiting = waitForMarker(
    acknowledgement,
    undefined,
    "timeoutしました",
    Date.now() + 1_000,
    cancellation,
  );
  setTimeout(() => fs.writeFileSync(cancellation, "cancelled\n"), 50);

  assert.equal(await waiting, "cancelled");
});
