import type { ExtensionAPI } from "@earendil-works/pi-coding-agent" with { "resolution-mode": "import" };

import { registerFormula } from "./api";

export default function formulaExtension(pi: ExtensionAPI): void {
  registerFormula(pi);
}
