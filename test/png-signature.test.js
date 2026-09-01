const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const { hasPngSignature } = require("../scripts/png-signature");

const extension = fs.readFileSync(
  path.resolve(__dirname, "../.pi/extensions/pi-formula-verify-image-path.ts"),
  "utf8",
);

test("完全な8 byte PNG署名を受理する", () => {
  assert.equal(hasPngSignature(Buffer.from("89504e470d0a1a0a00", "hex")), true);
});

test("画像経路markerは完全なPNG署名を検査する", () => {
  assert.match(extension, /hasPngSignature\(image\?\.data\)/u);
});

test("先頭byteが壊れたPNG署名を拒否する", () => {
  assert.equal(hasPngSignature(Buffer.from("00504e470d0a1a0a", "hex")), false);
});
