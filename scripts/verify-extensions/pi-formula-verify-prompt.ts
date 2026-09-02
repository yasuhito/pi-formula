import fs from "node:fs";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

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
  let textUpdates = 0;
  let waitingForCapture = false;

  pi.on("input", (event) => transformDisplayPrompt(event.text));
  pi.on("message_update", async (event) => {
    const marker = process.env.PI_FORMULA_VERIFY_STREAM_MARKER;
    const acknowledgement = process.env.PI_FORMULA_VERIFY_STREAM_ACK;
    if (
      process.env.PI_FORMULA_VERIFY_MODE !== "exploration" ||
      !marker ||
      !acknowledgement ||
      waitingForCapture ||
      event.assistantMessageEvent.type !== "text_delta" ||
      event.assistantMessageEvent.delta.length === 0
    )
      return;

    textUpdates += 1;
    if (textUpdates < 2) return;

    waitingForCapture = true;
    fs.writeFileSync(marker, `${textUpdates}\n`);
    await waitForCapture(acknowledgement);
  });
}
