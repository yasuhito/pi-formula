import { writeFileSync } from "node:fs";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { createFormulaPng } from "../../src/api";

const { hasPngSignature } = require("../../scripts/png-signature");

export default function (pi: ExtensionAPI) {
  pi.on("before_agent_start", () => {
    const marker = process.env.PI_FORMULA_VERIFY_IMAGE_MARKER;
    if (!marker) throw new Error("PI_FORMULA_VERIFY_IMAGE_MARKER is required");
    const image = createFormulaPng("x", 80);
    const isPng = hasPngSignature(image?.data);
    writeFileSync(marker, isPng ? "image\n" : "text\n");
  });
}
