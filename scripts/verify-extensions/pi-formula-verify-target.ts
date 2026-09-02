import fs from "node:fs";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

const { markTargetFormula } = require("../display-stream-formula");

export default function (pi: ExtensionAPI) {
  pi.registerMarkdownTransformer((markdown, context) => {
    const marker = process.env.PI_FORMULA_VERIFY_STREAM_MARKER;
    if (
      process.env.PI_FORMULA_VERIFY_MODE !== "exploration" ||
      context.messageType !== "assistant" ||
      context.isStreaming ||
      !marker ||
      !fs.existsSync(marker)
    )
      return markdown;
    return markTargetFormula(markdown, fs.readFileSync(marker, "utf8"));
  });
}
