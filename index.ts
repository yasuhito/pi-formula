import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent" with { "resolution-mode": "import" };

const packageManifest = JSON.parse(
  readFileSync(resolve(__dirname, "../../package.json"), "utf8")
) as { version?: unknown };

if (typeof packageManifest.version !== "string") {
  throw new Error("qni-math could not read the qni-cli package version");
}

const STATUS = `qni-math ${packageManifest.version}\npath: text (fixed)`;

export default function qniMathExtension(pi: ExtensionAPI): void {
  pi.registerCommand("math", {
    description: "Show qni-math status",
    handler: async (args, ctx) => {
      if (args.trim() !== "status") {
        ctx.ui.notify("Usage: /math status", "warning");
        return;
      }

      ctx.ui.setWidget("qni-math-status", STATUS.split("\n"), {
        placement: "belowEditor"
      });
    }
  });
}
