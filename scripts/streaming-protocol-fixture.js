#!/usr/bin/env node
const { Markdown } = require("@earendil-works/pi-tui");
const { fakePi, startWithKitty } = require("../test/support/fake-pi");
const { issue26Updates } = require("../features/support/streaming-regression");

const delay = (milliseconds) =>
  new Promise((resolve) => setTimeout(resolve, milliseconds));
const passthroughTheme = new Proxy({}, { get: () => (value) => value });

function terminalFrame(markdown) {
  const lines = new Markdown(markdown, 0, 0, passthroughTheme).render(80);
  return `\x1b[?2026h\x1b[2J\x1b[H${lines.join("\r\n")}\x1b[?2026l`;
}

async function writeFrame(frame) {
  await new Promise((resolve, reject) => {
    process.stdout.write(terminalFrame(frame), (error) => {
      if (error) reject(error);
      else resolve();
    });
  });
  await delay(100);
}

async function main() {
  const pi = fakePi();
  require("../dist/api.js").registerFormula(pi.api, {
    ket: [String.raw`\left|#1\right\rangle`, 1],
  });
  await startWithKitty(pi);
  const updates = issue26Updates(pi);
  for (const frame of [
    updates.precedingToolLines.join("\n"),
    ...updates.streaming,
    updates.finalized,
  ]) {
    await writeFrame(frame);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 2;
});
