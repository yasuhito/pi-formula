import assert from "node:assert/strict";
import test from "node:test";

const {
  hasPngSignature,
}: typeof import("../scripts/png-signature") = require("../scripts/png-signature");

test("完全な8 byte PNG署名を受理する", () => {
  assert.equal(hasPngSignature(Buffer.from("89504e470d0a1a0a00", "hex")), true);
});

test("7 byteのPNG署名prefixを拒否する", () => {
  assert.equal(hasPngSignature(Buffer.from("89504e470d0a1a", "hex")), false);
});

test("先頭byteが壊れたPNG署名を拒否する", () => {
  assert.equal(hasPngSignature(Buffer.from("00504e470d0a1a0a", "hex")), false);
});
