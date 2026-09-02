const PNG_SIGNATURE = Buffer.from("89504e470d0a1a0a", "hex");

function hasPngSignature(value) {
  return (
    Buffer.isBuffer(value) &&
    value.length >= PNG_SIGNATURE.length &&
    value.subarray(0, PNG_SIGNATURE.length).equals(PNG_SIGNATURE)
  );
}

module.exports = { hasPngSignature };
