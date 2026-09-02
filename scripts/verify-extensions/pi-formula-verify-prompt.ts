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

  const streamCaptureCancelled = () => {
    const marker = process.env.PI_FORMULA_VERIFY_STREAM_CANCEL_MARKER;
    return Boolean(marker && fs.existsSync(marker));
  };

  const observeDisplayFormula = (message: unknown) => {
    if (process.env.PI_FORMULA_VERIFY_MODE !== "exploration" || captureStarted)
      return;
    const next = advanceDisplayFormulaGate(readyFormula, message);
    readyFormula = next.readyFormula;
    targetInCurrentMessage ||= readyFormula !== undefined;
  };

  const recordUnavailableReason = (message: unknown) => {
    const unavailableMarker =
      process.env.PI_FORMULA_VERIFY_STREAM_UNAVAILABLE_MARKER;
    if (!unavailableMarker || fs.existsSync(unavailableMarker)) return;
    const finalFormula = advanceDisplayFormulaGate(
      undefined,
      message,
    ).readyFormula;
    const reason = readyFormula
      ? "表示数式を含む更新の後に Markdown transformer が実行されませんでした"
      : finalFormula
        ? "表示数式が確定と同時に現れました"
        : "表示数式が現れませんでした";
    fs.writeFileSync(unavailableMarker, `${reason}\n`);
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
      streamCaptureCancelled() ||
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
  pi.on("message_update", (event) => observeDisplayFormula(event.message));
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

    if (
      event.message.role === "assistant" &&
      event.message.stopReason !== "toolUse" &&
      !captureStarted
    )
      recordUnavailableReason(event.message);
    if (captureStarted && !streamCaptureCancelled()) {
      const acknowledgement = process.env.PI_FORMULA_VERIFY_STREAM_ACK;
      if (acknowledgement)
        await waitForMarker(
          acknowledgement,
          undefined,
          "ストリーミング中のキャプチャ確認が timeout しました",
          Date.now() + STREAM_GATE_TIMEOUT_MS,
        );
    }
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
      if (streamCaptureCancelled()) return markdown;
      const renderedMarker =
        process.env.PI_FORMULA_VERIFY_STREAM_RENDERED_MARKER;
      const marker = process.env.PI_FORMULA_VERIFY_STREAM_MARKER;
      if (
        renderedMarker &&
        marker &&
        readyFormula &&
        targetInCurrentMessage &&
        hasCompleteDisplayFormula(markdown, readyFormula)
      ) {
        fs.writeFileSync(renderedMarker, readyFormula);
        fs.writeFileSync(marker, readyFormula);
        captureStarted = true;
      }
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
