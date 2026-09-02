const VERIFY_DISPLAY_MACROS = Object.freeze({
  ket: [String.raw`\left|#1\right\rangle`, 1],
  bra: [String.raw`\left\langle#1\right|`, 1],
  braket: [String.raw`\left\langle#1\right\rangle`, 1],
});

module.exports = { VERIFY_DISPLAY_MACROS };
