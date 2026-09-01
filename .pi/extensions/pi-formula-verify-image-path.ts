import { writeFileSync } from "node:fs";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { createFormulaPng } from "../../src/api";

export default function (pi: ExtensionAPI) {
  pi.on("before_agent_start", () => {
    const marker = process.env.PI_FORMULA_VERIFY_IMAGE_MARKER;
    if (!marker) throw new Error("PI_FORMULA_VERIFY_IMAGE_MARKER is required");
    const image = createFormulaPng("x", 80);
    const isPng = image?.data.subarray(1, 4).toString("ascii") === "PNG";
    writeFileSync(marker, isPng ? "image\n" : "text\n");
  });
}
