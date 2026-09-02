import fs from "node:fs";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

const {
  advanceDisplayFormulaGate,
  hasCompleteDisplayFormula,
  inspectTargetFormulaRendering,
  targetFitsViewport,
} = require("../display-stream-formula");
const { transformDisplayPrompt } = require("../transform-display-prompt");

const STREAM_GATE_TIMEOUT_MS = 60_000;

function waitForMarker(
  marker: string,
  expected: string | undefined,
  timeoutMessage: string,
  deadline: number,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const poll = () => {
      let value: string | undefined;
      try {
        value = fs.readFileSync(marker, "utf8");
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
          reject(error);
          return;
        }
      }
      if (
        value !== undefined &&
        (expected === undefined || value === expected)
      ) {
        resolve();
        return;
      }
      if (Date.now() >= deadline) {
        reject(new Error(timeoutMessage));
        return;
      }
      setTimeout(poll, 25);
    };
    poll();
  });
}

export default function (pi: ExtensionAPI) {
  const processMarker = process.env.PI_FORMULA_VERIFY_STREAM_PROCESS_MARKER;
  if (process.env.PI_FORMULA_VERIFY_MODE === "exploration" && processMarker)
    fs.writeFileSync(processMarker, `${process.pid}\n`);

  let readyFormula: string | undefined;
  let captureStarted = false;
  let finalCaptureStarted = false;
  let targetInCurrentMessage = false;

  const gateWhenFormulaIsRendered = async (message: unknown) => {
    const marker = process.env.PI_FORMULA_VERIFY_STREAM_MARKER;
    const renderedMarker = process.env.PI_FORMULA_VERIFY_STREAM_RENDERED_MARKER;
    const acknowledgement = process.env.PI_FORMULA_VERIFY_STREAM_ACK;
    if (
      process.env.PI_FORMULA_VERIFY_MODE !== "exploration" ||
      !marker ||
      !renderedMarker ||
      !acknowledgement ||
      captureStarted
    )
      return;

    const next = advanceDisplayFormulaGate(readyFormula, message);
    readyFormula = next.readyFormula;
    targetInCurrentMessage ||= readyFormula !== undefined;
    if (!next.formulaToCapture) return;

    captureStarted = true;
    const gateDeadline = Date.now() + STREAM_GATE_TIMEOUT_MS;
    await waitForMarker(
      renderedMarker,
      next.formulaToCapture,
      "対象式をストリーミング用 Markdown 描画へ渡せませんでした",
      gateDeadline,
    );
    fs.writeFileSync(marker, next.formulaToCapture);
    await waitForMarker(
      acknowledgement,
      undefined,
      "ストリーミング中のキャプチャ確認が timeout しました",
      gateDeadline,
    );
  };

  pi.on("input", async (event) => {
    const transformed = transformDisplayPrompt(event.text);
    const baselineMarker = process.env.PI_FORMULA_VERIFY_BASELINE_MARKER;
    const baselineAcknowledgement = process.env.PI_FORMULA_VERIFY_BASELINE_ACK;
    if (
      process.env.PI_FORMULA_VERIFY_MODE === "exploration" &&
      baselineMarker &&
      baselineAcknowledgement
    ) {
      fs.writeFileSync(baselineMarker, "ready\n");
      await waitForMarker(
        baselineAcknowledgement,
        undefined,
        "対象式前のキャプチャ確認が timeout しました",
        Date.now() + STREAM_GATE_TIMEOUT_MS,
      );
    }
    return transformed;
  });
  pi.on("tool_call", async () => {
    const finalMarker = process.env.PI_FORMULA_VERIFY_FINAL_FORMULA_MARKER;
    const captureMarker = process.env.PI_FORMULA_VERIFY_FINAL_CAPTURE_MARKER;
    const acknowledgement = process.env.PI_FORMULA_VERIFY_FINAL_CAPTURE_ACK;
    if (
      process.env.PI_FORMULA_VERIFY_MODE !== "exploration" ||
      !captureStarted ||
      finalCaptureStarted ||
      !finalMarker ||
      !captureMarker ||
      !acknowledgement
    )
      return;

    finalCaptureStarted = true;
    const deadline = Date.now() + STREAM_GATE_TIMEOUT_MS;
    await waitForMarker(
      finalMarker,
      undefined,
      "対象式の確定描画を確認できませんでした",
      deadline,
    );
    fs.writeFileSync(captureMarker, "ready\n");
    await waitForMarker(
      acknowledgement,
      undefined,
      "対象式の確定キャプチャ確認が timeout しました",
      deadline,
    );
  });
  pi.on("message_start", (event) => {
    if (event.message.role === "assistant" && !captureStarted) {
      readyFormula = undefined;
      targetInCurrentMessage = false;
    }
  });
  pi.on("message_update", (event) => gateWhenFormulaIsRendered(event.message));
  pi.on("message_end", async (event) => {
    const finalMarker = process.env.PI_FORMULA_VERIFY_FINAL_FORMULA_MARKER;
    if (
      finalMarker &&
      targetInCurrentMessage &&
      readyFormula &&
      !advanceDisplayFormulaGate(readyFormula, event.message).hasReadyFormula &&
      !fs.existsSync(finalMarker)
    )
      fs.writeFileSync(finalMarker, "text\n");
    await gateWhenFormulaIsRendered(event.message);
    if (targetInCurrentMessage && captureStarted)
      targetInCurrentMessage = false;
  });
  pi.registerMarkdownTransformer((markdown, context) => {
    if (
      process.env.PI_FORMULA_VERIFY_MODE !== "exploration" ||
      context.messageType !== "assistant"
    )
      return markdown;

    if (context.isStreaming) {
      const renderedMarker =
        process.env.PI_FORMULA_VERIFY_STREAM_RENDERED_MARKER;
      if (
        renderedMarker &&
        readyFormula &&
        targetInCurrentMessage &&
        hasCompleteDisplayFormula(markdown, readyFormula)
      )
        fs.writeFileSync(renderedMarker, readyFormula);
      return markdown;
    }

    const result = inspectTargetFormulaRendering(markdown);
    const finalMarker = process.env.PI_FORMULA_VERIFY_FINAL_FORMULA_MARKER;
    if (finalMarker && result.foundTarget && !fs.existsSync(finalMarker)) {
      const fallbackRows = Math.floor(
        Number(process.env.PI_FORMULA_VERIFY_HEIGHT) / 16,
      );
      const fitsViewport = targetFitsViewport(
        markdown,
        context.availableWidth,
        process.stdout.rows ?? fallbackRows,
      );
      const finalPath = result.renderedAsImage
        ? fitsViewport
          ? "image\n"
          : "offscreen\n"
        : "text\n";
      fs.writeFileSync(finalMarker, finalPath);
    }
    return result.markdown;
  });
}
