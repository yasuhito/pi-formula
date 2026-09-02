#!/usr/bin/env node

const { setTimeout: sleep } = require("node:timers/promises");
const { verifyImagePath } = require("./verify-image-path");

async function waitForImagePath(marker, timeoutMs, intervalMs) {
  const deadline = performance.now() + timeoutMs;
  let attempts = 0;
  do {
    attempts += 1;
    try {
      verifyImagePath(marker);
      return attempts;
    } catch {
      // 確認記録は起動中に変わるため、期限までは再確認する。
    }
    await sleep(
      Math.min(intervalMs, Math.max(0, deadline - performance.now())),
    );
  } while (performance.now() < deadline);
  attempts += 1;
  verifyImagePath(marker);
  return attempts;
}

function positiveMilliseconds(value) {
  const milliseconds = Number(value);
  return Number.isFinite(milliseconds) && milliseconds > 0
    ? milliseconds
    : undefined;
}

async function main() {
  const marker = process.argv[2];
  const timeoutMs = positiveMilliseconds(process.argv[3]);
  const intervalMs = positiveMilliseconds(process.argv[4]);
  if (!marker || timeoutMs === undefined || intervalMs === undefined) {
    console.error(
      "Usage: wait-for-image-path.js <marker> <timeout-ms> <interval-ms>",
    );
    process.exitCode = 2;
    return;
  }
  try {
    await waitForImagePath(marker, timeoutMs, intervalMs);
  } catch (error) {
    console.error(`画像経路検証失敗: ${error.message}`);
    process.exitCode = 2;
  }
}

if (require.main === module) void main();
module.exports = { waitForImagePath };
