import assert from "node:assert/strict";
import test from "node:test";

const {
  hasPngSignature,
}: typeof import("../scripts/png-signature") = require("../scripts/png-signature");

test("a complete 8-byte PNG signature is accepted", () => {
  assert.equal(hasPngSignature(Buffer.from("89504e470d0a1a0a00", "hex")), true);
});

test("a 7-byte PNG signature prefix is rejected", () => {
  assert.equal(hasPngSignature(Buffer.from("89504e470d0a1a", "hex")), false);
});

test("a PNG signature with a corrupted first byte is rejected", () => {
  assert.equal(hasPngSignature(Buffer.from("00504e470d0a1a0a", "hex")), false);
});
