export const quantumMacros = {
  // Property order and formatting are not part of the macro contract.
  braket: ["\\left\\langle#1\\right\\rangle", 1],
  bra: ["\\left\\langle#1\\right|", 1],
  ket: ["\\left|#1\\right\\rangle", 1],
} as const;
