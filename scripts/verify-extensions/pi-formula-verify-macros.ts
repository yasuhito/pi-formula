import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { registerFormula } from "../../src/api";

const {
  VERIFY_DISPLAY_MACROS,
} = require("../../scripts/verify-display-macros");

export default function (pi: ExtensionAPI) {
  registerFormula(pi, VERIFY_DISPLAY_MACROS);
}
