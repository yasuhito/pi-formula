import { randomBytes } from "node:crypto";
import { constants } from "node:fs";
import {
  access,
  mkdir,
  readFile,
  rename,
  stat,
  writeFile,
} from "node:fs/promises";
import { homedir } from "node:os";
import { basename, join, resolve } from "node:path";
import { setTimeout as sleep } from "node:timers/promises";

import type {
  DisplayPlan,
  DisplayRunFiles,
  DisplayVerificationOptions,
} from "./display-verification-contract";
import {
  type DisplayProcessAdapter,
  type ManagedProcess,
  NodeDisplayProcessAdapter,
  type ProcessOutcome,
} from "./display-verification-process";
import { writeDisplayRuntime } from "./display-verification-runtime";
import { loadPng } from "./png-source";

type DisplayFailureStage =
  | "prepare"
  | "launch"
  | "verify-response"
  | "capture"
  | "cleanup";

export type { DisplayVerificationOptions } from "./display-verification-contract";

export type DisplayVerificationResult =
  | {
      kind: "captured";
      artifactDirectory: string;
      captures: string[];
      protocolChecks: string[];
      conditions: Pick<
        DisplayVerificationOptions,
        "theme" | "terminal" | "path" | "reflow" | "extension"
      >;
    }
  | { kind: "rejected"; reason: string; artifactDirectory?: string }
  | {
      kind: "failed";
      stage: DisplayFailureStage;
      message: string;
      artifactDirectory?: string;
      cleanupDiagnostics?: string[];
    };

export interface DisplayVerificationDependencies {
  process: DisplayProcessAdapter;
  rootDirectory: string;
  env: NodeJS.ProcessEnv;
  platform: NodeJS.Platform;
  pollIntervalMs: number;
}

class VerificationFailure extends Error {
  constructor(
    readonly stage: DisplayFailureStage,
    message: string,
    readonly rejected = false,
  ) {
    super(message);
  }
}

const CAPTURE_PNG_LIMITS = Object.freeze({
  bytes: 128 * 1024 * 1024,
  pixels: 1920 * 16_000,
});
const COMMAND_TIMEOUT_MS = 8_000;
const SESSION_TIMEOUT_MS = 150_000;
const READY_TIMEOUT_MS = 30_000;
const WINDOW_TIMEOUT_MS = 270_000;

function displayPathLabel(path: string): string {
  if (path === "image") return "画像経路";
  if (path === "text") return "テキスト経路";
  return `${path}経路`;
}

function defaultArtifactsRoot(env: NodeJS.ProcessEnv): string {
  const state = env.XDG_STATE_HOME || join(homedir(), ".local", "state");
  return join(state, "pi-formula", "verify-display");
}

function parseDisplayVerificationOptions(
  args: readonly string[],
  env: NodeJS.ProcessEnv = process.env,
  rootDirectory = resolve(__dirname, ".."),
): DisplayVerificationOptions {
  let theme: DisplayVerificationOptions["theme"] = "light";
  let terminal: DisplayVerificationOptions["terminal"] = "ghostty";
  let displayPath: DisplayVerificationOptions["path"] = "image";
  let extension = join(rootDirectory, "src", "extension.ts");
  let reflow: number | null = null;
  let artifactsRoot = defaultArtifactsRoot(env);
  let corpus: string | undefined;
  const remaining = [...args];
  while (remaining.length > 0) {
    const argument = remaining.shift() as string;
    if (!argument.startsWith("--")) {
      if (corpus) throw new Error("コーパスは一つだけ指定できます");
      corpus = argument;
      continue;
    }
    const value = remaining.shift();
    if (value === undefined) throw new Error(`${argument} に値がありません`);
    if (argument === "--theme" && (value === "light" || value === "dark"))
      theme = value;
    else if (
      argument === "--terminal" &&
      (value === "ghostty" || value === "kitty")
    )
      terminal = value;
    else if (argument === "--path" && (value === "image" || value === "text"))
      displayPath = value;
    else if (argument === "--extension") extension = resolve(value);
    else if (argument === "--artifacts") artifactsRoot = resolve(value);
    else if (argument === "--reflow" && /^[1-9][0-9]*$/u.test(value)) {
      const columns = Number(value);
      if (!Number.isSafeInteger(columns))
        throw new Error(`未対応の設定です: ${argument} ${value}`);
      reflow = columns;
    } else throw new Error(`未対応の設定です: ${argument} ${value}`);
  }
  if (!corpus) throw new Error("コーパスを指定してください");
  return {
    corpus: resolve(corpus),
    theme,
    terminal,
    path: displayPath,
    extension,
    reflow,
    artifactsRoot,
  };
}

async function createRunFiles(root: string): Promise<DisplayRunFiles> {
  await mkdir(root, { recursive: true });
  const timestamp = new Date().toISOString().replaceAll(":", "-");
  const directory = join(
    root,
    `${timestamp}-${process.pid}-${randomBytes(4).toString("hex")}`,
  );
  await mkdir(directory);
  const files = {
    directory,
    session: join(directory, "session.jsonl"),
    cageLog: join(directory, "cage.log"),
    configHome: join(directory, "config"),
    pathMarker: join(directory, "display-path"),
    display: join(directory, "wayland-display"),
    output: join(directory, "wayland-output"),
    terminalConfig: join(directory, "terminal.conf"),
    runner: join(directory, "run-pi"),
    launcher: join(directory, "launch-session"),
    plan: join(directory, "plan.json"),
    protocol: join(directory, "protocol.json"),
    result: join(directory, "result.json"),
  };
  await mkdir(files.configHome);
  return files;
}

async function ensureReadable(filename: string, label: string): Promise<void> {
  try {
    await access(filename, constants.R_OK);
    if (!(await stat(filename)).isFile()) throw new Error("not a file");
  } catch {
    throw new VerificationFailure(
      "prepare",
      `${label}が読めません: ${filename}`,
      true,
    );
  }
}

function validPlan(value: unknown): value is DisplayPlan {
  const plan = value as Partial<DisplayPlan>;
  return (
    Number.isSafeInteger(plan.height) &&
    (plan.height ?? 0) > 0 &&
    Number.isSafeInteger(plan.initialWidth) &&
    (plan.initialWidth ?? 0) > 0 &&
    (plan.reflowWidth === null || Number.isSafeInteger(plan.reflowWidth)) &&
    Number.isSafeInteger(plan.displayFormulas)
  );
}

function processFailure(
  label: string,
  outcome: ProcessOutcome,
  fallback: string,
): string {
  const detail = [outcome.stderr.trim() || fallback]
    .concat(outcome.cleanupDiagnostics ?? [])
    .join("; ");
  return `${label}: ${detail}`;
}

async function preparePlan(
  options: DisplayVerificationOptions,
  files: DisplayRunFiles,
  dependencies: DisplayVerificationDependencies,
  signal?: AbortSignal,
): Promise<DisplayPlan> {
  const args = [
    join(dependencies.rootDirectory, "scripts/verify-display-plan.js"),
  ];
  args.push("--path", options.path);
  if (options.reflow !== null) args.push("--reflow", String(options.reflow));
  args.push(options.corpus);
  const outcome = await dependencies.process.run(
    {
      label: "display-plan",
      operation: "plan",
      command: process.execPath,
      args,
      cwd: dependencies.rootDirectory,
      env: dependencies.env,
      timeoutMs: 120_000,
    },
    signal,
  );
  if (outcome.status !== 0) {
    const detail = outcome.stderr.trim() || "表示計画を作れませんでした";
    const rejected = /収まりません|表示数式がありません/u.test(detail);
    throw new VerificationFailure(
      "prepare",
      processFailure("display-plan", outcome, detail),
      rejected,
    );
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(outcome.stdout);
  } catch {
    throw new VerificationFailure("prepare", "表示計画がJSONではありません");
  }
  if (!validPlan(parsed))
    throw new VerificationFailure("prepare", "表示計画の内容が不正です");
  await writeFile(files.plan, `${JSON.stringify(parsed, null, 2)}\n`);
  return parsed;
}

const PROTOCOL_CHECKS = [
  "verify:encoder-protocol",
  "verify:pi-protocol",
  "verify:streaming-protocol",
] as const;

async function verifyProtocols(
  files: DisplayRunFiles,
  dependencies: DisplayVerificationDependencies,
  signal?: AbortSignal,
): Promise<string[]> {
  const results = [];
  for (const check of PROTOCOL_CHECKS) {
    const outcome = await dependencies.process.run(
      {
        label: check,
        operation: "protocol",
        command: "npm",
        args: ["run", check],
        cwd: dependencies.rootDirectory,
        env: dependencies.env,
        timeoutMs: 120_000,
      },
      signal,
    );
    if (outcome.status !== 0 || outcome.timedOut) {
      throw new VerificationFailure(
        "prepare",
        processFailure(check, outcome, "検査が失敗しました"),
      );
    }
    results.push(check);
  }
  await writeFile(files.protocol, `${JSON.stringify(results, null, 2)}\n`);
  return results;
}

async function readWhenReady(
  filename: string,
  deadline: number,
  interval: number,
  signal?: AbortSignal,
  stopped?: () => string | undefined,
): Promise<string> {
  while (Date.now() < deadline) {
    const stoppedReason = stopped?.();
    if (stoppedReason) throw new Error(stoppedReason);
    if (signal?.aborted) throw new Error("実表示検証が中断されました");
    try {
      const value = (await readFile(filename, "utf8")).trim();
      if (value) return value;
    } catch {}
    await sleep(interval, undefined, { signal });
  }
  throw new Error(`${basename(filename)} の準備がtimeoutしました`);
}

interface SessionRecord {
  type?: unknown;
  message?: {
    role?: unknown;
    stopReason?: unknown;
    content?: unknown;
  };
}

function sessionRecords(source: string): SessionRecord[] {
  return source
    .trim()
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}

function sessionComplete(source: string): boolean {
  return sessionRecords(source).some(
    (record) =>
      record.type === "message" &&
      record.message?.role === "assistant" &&
      record.message?.stopReason === "stop",
  );
}

async function waitForSession(
  filename: string,
  dependencies: DisplayVerificationDependencies,
  signal?: AbortSignal,
): Promise<void> {
  const deadline = Date.now() + SESSION_TIMEOUT_MS;
  while (Date.now() < deadline) {
    try {
      if (sessionComplete(await readFile(filename, "utf8"))) return;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
    await sleep(dependencies.pollIntervalMs, undefined, { signal });
  }
  throw new Error("Piの応答がtimeoutしました");
}

function withoutTrailingNewlines(text: string): string {
  return text.replace(/[\r\n]+$/u, "");
}

function assistantText(source: string): string {
  const assistant = sessionRecords(source)
    .filter(
      (record) =>
        record.type === "message" && record.message?.role === "assistant",
    )
    .at(-1);
  if (assistant?.message?.stopReason !== "stop")
    throw new Error("最後のassistant messageが完了していません");
  const content = assistant.message.content;
  if (!Array.isArray(content))
    throw new Error("assistant contentが配列ではありません");
  return content
    .filter(
      (part: unknown) =>
        (part as { type?: unknown }).type === "text" &&
        typeof (part as { text?: unknown }).text === "string",
    )
    .map((part: { text: string }) => part.text)
    .join("");
}

async function verifyResponse(corpus: string, session: string): Promise<void> {
  const expected = withoutTrailingNewlines(await readFile(corpus, "utf8"));
  const actual = withoutTrailingNewlines(
    assistantText(await readFile(session, "utf8")),
  );
  if (expected !== actual)
    throw new Error("assistantの応答がコーパスと一字一句一致しません");
}

async function stableCapture(
  label: string,
  destination: string,
  width: number,
  height: number,
  display: string,
  dependencies: DisplayVerificationDependencies,
  signal?: AbortSignal,
): Promise<void> {
  const attempt = `${destination}.attempt`;
  let previous: Buffer | undefined;
  const deadline = Date.now() + READY_TIMEOUT_MS;
  while (Date.now() < deadline) {
    const outcome = await dependencies.process.run(
      {
        label: `capture-${label}`,
        operation: label === "initial" ? "capture-initial" : "capture-reflow",
        command: "grim",
        args: [attempt],
        env: { ...dependencies.env, WAYLAND_DISPLAY: display },
        timeoutMs: COMMAND_TIMEOUT_MS,
      },
      signal,
    );
    if (outcome.status !== 0)
      throw new Error(
        processFailure(`capture-${label}`, outcome, "grimが失敗しました"),
      );
    const current = await readFile(attempt);
    const loaded = loadPng(current, CAPTURE_PNG_LIMITS);
    if (!loaded.loaded) throw new Error("キャプチャをPNGとして読めません");
    if (loaded.width !== width || loaded.height !== height)
      throw new Error(
        `キャプチャが${width}x${height}ではありません: ${loaded.width}x${loaded.height}`,
      );
    if (previous?.equals(current)) {
      await rename(attempt, destination);
      return;
    }
    previous = current;
    await sleep(dependencies.pollIntervalMs, undefined, { signal });
  }
  throw new Error("キャプチャが安定する前にtimeoutしました");
}

function withCleanupDiagnostics(
  result: DisplayVerificationResult,
  diagnostics: string[],
  directory?: string,
): DisplayVerificationResult {
  if (diagnostics.length === 0) return result;
  if (result.kind === "failed")
    return {
      ...result,
      cleanupDiagnostics: [
        ...(result.cleanupDiagnostics ?? []),
        ...diagnostics,
      ],
    };
  return {
    kind: "failed",
    stage: "cleanup",
    message: "検証セッションを停止または記録できませんでした",
    artifactDirectory: directory,
    cleanupDiagnostics: diagnostics,
  };
}

function failedResult(
  failure: unknown,
  directory?: string,
): DisplayVerificationResult {
  const error = failure as Partial<VerificationFailure>;
  if (error instanceof VerificationFailure && error.rejected)
    return {
      kind: "rejected",
      reason: error.message,
      ...(directory ? { artifactDirectory: directory } : {}),
    };
  return {
    kind: "failed",
    stage: error.stage ?? "prepare",
    message: error.message ?? String(failure),
    ...(directory ? { artifactDirectory: directory } : {}),
  };
}

function defaultDependencies(): DisplayVerificationDependencies {
  return {
    process: new NodeDisplayProcessAdapter(),
    rootDirectory: resolve(__dirname, ".."),
    env: process.env,
    platform: process.platform,
    pollIntervalMs: 250,
  };
}

export async function verifyDisplay(
  options: DisplayVerificationOptions,
  supplied: Partial<DisplayVerificationDependencies> = {},
  signal?: AbortSignal,
): Promise<DisplayVerificationResult> {
  const dependencies = { ...defaultDependencies(), ...supplied };
  let files: DisplayRunFiles | undefined;
  let cage: ManagedProcess | undefined;
  let result: DisplayVerificationResult;
  try {
    files = await createRunFiles(options.artifactsRoot);
    if (dependencies.platform !== "linux")
      throw new VerificationFailure(
        "prepare",
        "実表示検証はLinux headless Waylandだけに対応します",
      );
    await ensureReadable(options.corpus, "コーパス");
    await ensureReadable(options.extension, "拡張");
    const plan = await preparePlan(options, files, dependencies, signal);
    const protocolChecks = await verifyProtocols(files, dependencies, signal);
    await writeDisplayRuntime(options, files, plan, dependencies.rootDirectory);

    const cageEnvironment = { ...dependencies.env };
    delete cageEnvironment.DISPLAY;
    delete cageEnvironment.WAYLAND_DISPLAY;
    cageEnvironment.WLR_BACKENDS = "headless";
    cageEnvironment.WLR_LIBINPUT_NO_DEVICES = "1";
    try {
      cage = dependencies.process.spawn(
        {
          label: "headless-session",
          operation: "launch",
          command: "cage",
          args: ["-d", "--", files.launcher],
          env: cageEnvironment,
          timeoutMs: WINDOW_TIMEOUT_MS,
        },
        signal,
      );
    } catch (error) {
      throw new VerificationFailure(
        "launch",
        `headless-session: ${(error as Error).message}`,
      );
    }
    let stoppedReason: string | undefined;
    void cage.completion.then((outcome) => {
      stoppedReason = processFailure(
        "headless-session",
        outcome,
        `検証セッションが終了コード${outcome.status}で停止しました`,
      );
    });

    let display: string;
    let output: string;
    try {
      const readyDeadline = Date.now() + READY_TIMEOUT_MS;
      display = await readWhenReady(
        files.display,
        readyDeadline,
        dependencies.pollIntervalMs,
        signal,
        () => stoppedReason,
      );
      output = await readWhenReady(
        files.output,
        readyDeadline,
        dependencies.pollIntervalMs,
        signal,
        () => stoppedReason,
      );
      const selectedPath = await readWhenReady(
        files.pathMarker,
        Date.now() + READY_TIMEOUT_MS,
        dependencies.pollIntervalMs,
        signal,
        () => stoppedReason,
      );
      if (selectedPath !== options.path)
        throw new Error(
          `要求した${displayPathLabel(options.path)}ではなく${displayPathLabel(selectedPath)}が選ばれました`,
        );
    } catch (error) {
      throw new VerificationFailure("launch", (error as Error).message);
    }

    try {
      await waitForSession(files.session, dependencies, signal);
      await verifyResponse(options.corpus, files.session);
    } catch (error) {
      throw new VerificationFailure(
        "verify-response",
        (error as Error).message,
      );
    }

    const captures: string[] = [];
    const initialCapture = join(files.directory, "initial.png");
    try {
      await stableCapture(
        "initial",
        initialCapture,
        plan.initialWidth,
        plan.height,
        display,
        dependencies,
        signal,
      );
      captures.push(initialCapture);
      if (options.reflow !== null && plan.reflowWidth !== null) {
        const resized = await dependencies.process.run(
          {
            label: "reflow",
            operation: "reflow",
            command: "wlr-randr",
            args: [
              "--output",
              output,
              "--custom-mode",
              `${plan.reflowWidth}x${plan.height}`,
            ],
            env: { ...dependencies.env, WAYLAND_DISPLAY: display },
            timeoutMs: COMMAND_TIMEOUT_MS,
          },
          signal,
        );
        if (resized.status !== 0)
          throw new Error(
            processFailure("reflow", resized, "描き直し幅へ変更できません"),
          );
        const reflowCapture = join(files.directory, "reflow.png");
        await stableCapture(
          "reflow",
          reflowCapture,
          plan.reflowWidth,
          plan.height,
          display,
          dependencies,
          signal,
        );
        captures.push(reflowCapture);
      }
    } catch (error) {
      throw new VerificationFailure("capture", (error as Error).message);
    }
    result = {
      kind: "captured",
      artifactDirectory: files.directory,
      captures,
      protocolChecks,
      conditions: {
        theme: options.theme,
        terminal: options.terminal,
        path: options.path,
        reflow: options.reflow,
        extension: options.extension,
      },
    };
  } catch (error) {
    result = failedResult(error, files?.directory);
  }

  let cleanupDiagnostics: string[] = [];
  let cleanupThrew = false;
  if (cage) {
    try {
      cleanupDiagnostics = await cage.terminate();
    } catch (error) {
      cleanupThrew = true;
      cleanupDiagnostics = [(error as Error).message];
    }
  }
  if (cage && files && !cleanupThrew && cleanupDiagnostics.length === 0) {
    try {
      const outcome = await cage.completion;
      await writeFile(files.cageLog, `${outcome.stdout}${outcome.stderr}`);
    } catch (error) {
      cleanupDiagnostics.push((error as Error).message);
    }
  }
  result = withCleanupDiagnostics(result, cleanupDiagnostics, files?.directory);
  if (files) {
    try {
      await writeFile(files.result, `${JSON.stringify(result, null, 2)}\n`);
    } catch (error) {
      result = withCleanupDiagnostics(
        result,
        [`result.json: ${(error as Error).message}`],
        files.directory,
      );
    }
  }
  return result;
}

export async function verifyDisplayArguments(
  args: readonly string[],
  supplied: Partial<DisplayVerificationDependencies> = {},
  signal?: AbortSignal,
): Promise<DisplayVerificationResult> {
  const dependencies = { ...defaultDependencies(), ...supplied };
  try {
    const options = parseDisplayVerificationOptions(
      args,
      dependencies.env,
      dependencies.rootDirectory,
    );
    return await verifyDisplay(options, dependencies, signal);
  } catch (error) {
    const result: DisplayVerificationResult = {
      kind: "rejected",
      reason: (error as Error).message,
    };
    const artifactOption = args.indexOf("--artifacts");
    const root =
      artifactOption >= 0 && args[artifactOption + 1]
        ? resolve(args[artifactOption + 1])
        : defaultArtifactsRoot(dependencies.env);
    try {
      const files = await createRunFiles(root);
      const recorded = { ...result, artifactDirectory: files.directory };
      await writeFile(files.result, `${JSON.stringify(recorded, null, 2)}\n`);
      return recorded;
    } catch {
      return result;
    }
  }
}

export function displayVerificationExitCode(
  result: DisplayVerificationResult,
): 0 | 1 | 2 {
  return result.kind === "captured" ? 0 : result.kind === "rejected" ? 1 : 2;
}
