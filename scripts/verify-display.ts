#!/usr/bin/env node

const {
  runDisplayVerificationCli,
}: typeof import("../dist/display-verification-cli.js") = require("../dist/display-verification-cli.js");

void runDisplayVerificationCli({
  argv: process.argv,
  stdout: process.stdout,
  stderr: process.stderr,
  on: (signal, listener) => process.on(signal, listener),
  get exitCode() {
    return typeof process.exitCode === "number" ? process.exitCode : undefined;
  },
  set exitCode(code: number | undefined) {
    process.exitCode = code;
  },
});
