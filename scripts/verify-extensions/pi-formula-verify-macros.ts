import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { registerFormula } from "../../dist/api.js";

const {
  VERIFY_DISPLAY_MACROS,
}: typeof import("../verify-display-macros") = require("../verify-display-macros");

export default function (pi: ExtensionAPI) {
  registerFormula(pi, VERIFY_DISPLAY_MACROS);
}
