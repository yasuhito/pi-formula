#!/usr/bin/env node
import { fakePi, startWithKitty } from "../test/support/fake-pi";

const {
  issue26Updates,
}: {
  issue26Updates(pi: ReturnType<typeof fakePi>): {
    tuiWrites: { initial: string; streaming: string[]; finalized: string };
  };
} = require("../features/support/streaming-regression");

const delay = (milliseconds: number) =>
  new Promise((resolve) => setTimeout(resolve, milliseconds));

async function writeUpdate(update: string) {
  await new Promise<void>((resolve, reject) => {
    process.stdout.write(update, (error) => {
      if (error) reject(error);
      else resolve();
    });
  });
  await delay(100);
}

async function main() {
  const pi = fakePi();
  const {
    registerFormula,
  }: typeof import("../dist/api.js") = require("../dist/api.js");
  registerFormula(pi.api, {
    ket: [String.raw`\left|#1\right\rangle`, 1],
  });
  await startWithKitty(pi);
  const writes = issue26Updates(pi).tuiWrites;
  for (const update of [
    writes.initial,
    ...writes.streaming,
    writes.finalized,
  ]) {
    await writeUpdate(update);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 2;
});
