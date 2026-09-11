import {
  type DisplayVerificationResult,
  displayVerificationExitCode,
  verifyDisplayArguments,
} from "./display-verification";

interface DisplayVerificationCliProcess {
  argv: string[];
  exitCode?: number;
  stdout: { write(value: string): unknown };
  stderr: { write(value: string): unknown };
  on(signal: NodeJS.Signals, listener: () => void): unknown;
}

type VerifyArguments = (
  args: readonly string[],
  signal: AbortSignal,
) => Promise<DisplayVerificationResult>;

const verify: VerifyArguments = (args, signal) =>
  verifyDisplayArguments(args, {}, signal);

export async function runDisplayVerificationCli(
  runtime: DisplayVerificationCliProcess,
  verifyArguments: VerifyArguments = verify,
): Promise<void> {
  const controller = new AbortController();
  let signals = 0;
  for (const signal of ["SIGINT", "SIGTERM", "SIGHUP"] as const) {
    runtime.on(signal, () => {
      signals += 1;
      if (signals === 1) controller.abort();
      else runtime.exitCode = 2;
    });
  }

  let result: DisplayVerificationResult;
  try {
    result = await verifyArguments(runtime.argv.slice(2), controller.signal);
  } catch (error) {
    result = { kind: "failed", stage: "cleanup", message: String(error) };
  }
  runtime.stdout.write(`${JSON.stringify(result)}\n`);
  if (result.kind === "rejected") runtime.stderr.write(`${result.reason}\n`);
  if (result.kind === "failed") runtime.stderr.write(`${result.message}\n`);
  runtime.exitCode = displayVerificationExitCode(result);
}
