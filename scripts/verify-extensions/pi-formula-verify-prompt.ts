import fs from "node:fs";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

const {
  advanceDisplayFormulaGate,
  inspectTargetFormulaRendering,
} = require("../display-stream-formula");
const { transformDisplayPrompt } = require("../transform-display-prompt");

const STREAM_GATE_TIMEOUT_MS = 60_000;

function waitForCapture(acknowledgement: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const deadline = Date.now() + STREAM_GATE_TIMEOUT_MS;
    const poll = () => {
      if (fs.existsSync(acknowledgement)) {
        resolve();
        return;
      }
      if (Date.now() >= deadline) {
        reject(
          new Error("ストリーミング中のキャプチャ確認が timeout しました"),
        );
        return;
      }
      setTimeout(poll, 25);
    };
    poll();
  });
}

export default function (pi: ExtensionAPI) {
  let readyFormula: string | undefined;
  let waitingForCapture = false;

  const gateWhenFormulaIsRendered = async (message: unknown) => {
    const marker = process.env.PI_FORMULA_VERIFY_STREAM_MARKER;
    const acknowledgement = process.env.PI_FORMULA_VERIFY_STREAM_ACK;
    if (
      process.env.PI_FORMULA_VERIFY_MODE !== "exploration" ||
      !marker ||
      !acknowledgement ||
      waitingForCapture
    )
      return;

    const next = advanceDisplayFormulaGate(readyFormula, message);
    readyFormula = next.readyFormula;
    if (!next.formulaToCapture) return;

    waitingForCapture = true;
    fs.writeFileSync(marker, next.formulaToCapture);
    await waitForCapture(acknowledgement);
  };

  pi.on("input", (event) => transformDisplayPrompt(event.text));
  pi.on("message_update", (event) => gateWhenFormulaIsRendered(event.message));
  pi.on("message_end", (event) => gateWhenFormulaIsRendered(event.message));
  pi.registerMarkdownTransformer((markdown, context) => {
    if (
      process.env.PI_FORMULA_VERIFY_MODE !== "exploration" ||
      context.messageType !== "assistant" ||
      context.isStreaming
    )
      return markdown;
    const result = inspectTargetFormulaRendering(markdown);
    const finalMarker = process.env.PI_FORMULA_VERIFY_FINAL_FORMULA_MARKER;
    if (finalMarker)
      fs.writeFileSync(
        finalMarker,
        result.renderedAsImage ? "image\n" : "text\n",
      );
    return result.markdown;
  });
}
