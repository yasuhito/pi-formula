import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

const { transformDisplayPrompt } = require("../transform-display-prompt");

export default function (pi: ExtensionAPI) {
  pi.on("input", (event) => transformDisplayPrompt(event.text));
}
