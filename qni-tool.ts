type TruncationApi = {
  DEFAULT_MAX_BYTES: number;
  DEFAULT_MAX_LINES: number;
  formatSize(bytes: number): string;
  truncateHead(content: string, options: { maxBytes: number; maxLines: number }): {
    content: string;
    truncated: boolean;
    totalLines: number;
    totalBytes: number;
    outputLines: number;
    outputBytes: number;
  };
};

const truncationApi = import("@earendil-works/pi-coding-agent") as Promise<TruncationApi>;

export type QniToolParams = {
  args?: string[];
  commands?: string[][];
  workdir?: string;
};

export type QniCommandDetail = {
  args: string[];
  latex?: string;
};

export type QniToolDetails =
  | { latex?: string; workdir: string }
  | { workdir: string; commands: QniCommandDetail[] };

export type QniExecResult = {
  stdout: string;
  stderr: string;
  code: number | null;
  killed: boolean;
};

export type FormattedOutput = {
  text: string;
  truncated: boolean;
};

export function validateQniToolParams(params: QniToolParams): void {
  const hasArgs = params.args !== undefined;
  const hasCommands = params.commands !== undefined;
  if (hasArgs === hasCommands) {
    throw new Error("qni tool requires exactly one of args or commands");
  }
  if (hasCommands && (
    params.commands!.length === 0
    || params.commands!.some((command) => command.length === 0)
  )) {
    throw new Error("qni tool commands must contain at least one non-empty command");
  }
}

function quoteShellArgument(argument: string): string {
  if (argument !== "" && /^[\p{L}\p{M}\p{N}_@%+=:,./-]+$/u.test(argument)) return argument;
  return `'${argument.replaceAll("'", `'"'"'`)}'`;
}

export function formatCommandHeading(args: readonly string[]): string {
  return `$ qni ${args.map(quoteShellArgument).join(" ")}`;
}

export async function truncateQniOutput(stdout: string): Promise<FormattedOutput> {
  const { DEFAULT_MAX_BYTES, DEFAULT_MAX_LINES, formatSize, truncateHead } = await truncationApi;
  const truncated = truncateHead(stdout, {
    maxBytes: DEFAULT_MAX_BYTES,
    maxLines: DEFAULT_MAX_LINES
  });
  if (!truncated.truncated) return { text: stdout, truncated: false };

  const separator = truncated.content === "" || truncated.content.endsWith("\n") ? "" : "\n";
  const notice = `[Output truncated: ${truncated.outputLines} of ${truncated.totalLines} lines (`
    + `${formatSize(truncated.outputBytes)} of ${formatSize(truncated.totalBytes)})]`;
  return { text: `${truncated.content}${separator}${notice}`, truncated: true };
}

export async function formatCommandOutput(
  args: readonly string[],
  stdout: string
): Promise<FormattedOutput> {
  const output = await truncateQniOutput(stdout);
  return {
    text: output.text === ""
      ? formatCommandHeading(args)
      : `${formatCommandHeading(args)}\n${output.text}`,
    truncated: output.truncated
  };
}

export function formatQniExitError(result: QniExecResult): string {
  const stderr = result.stderr.trimEnd();
  return `${stderr ? `${stderr}\n` : ""}qni exited with status ${result.code}`;
}

export function formatBatchFailure(
  successfulOutputs: readonly string[],
  failedArgs: readonly string[],
  result: QniExecResult,
  failedIndex: number,
  totalCommands: number
): string {
  const blocks = [
    ...successfulOutputs.map((output) => output.trimEnd()),
    formatCommandHeading(failedArgs),
    formatQniExitError(result)
  ];
  const succeeded = failedIndex === 0
    ? "No commands succeeded."
    : `Commands ${failedIndex === 1 ? "1" : `1-${failedIndex}`} succeeded and their changes remain in the workdir.`;
  const firstNotRun = failedIndex + 2;
  const remainingCount = totalCommands - failedIndex - 1;
  const remaining = remainingCount === 0
    ? ""
    : remainingCount === 1
      ? ` Command ${firstNotRun} was not run.`
      : ` Commands ${firstNotRun}-${totalCommands} were not run.`;
  blocks.push(
    `Stopped at command ${failedIndex + 1} of ${totalCommands}. ${succeeded}${remaining}`
  );
  return blocks.join("\n");
}
