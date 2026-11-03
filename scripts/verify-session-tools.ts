#!/usr/bin/env node

import fs from "node:fs";

import {
  isRecord,
  optionalString,
  parseJson,
} from "../test/support/json-value.js";

interface Content {
  type: string;
  text?: string;
  id?: string;
  name?: string;
  arguments?: Record<string, unknown>;
}
interface Message {
  role?: string;
  content: Content[];
  toolName?: string;
  toolCallId?: string;
  isError?: boolean;
}
interface RecordEntry {
  index: number;
  record: { message?: Message };
}
interface Hit {
  kind: string;
  tool: string;
  command: string;
  recordIndex: number;
  text: string;
  context: string[];
}
interface IgnoreEntry {
  kind?: string;
  tool?: string;
  command?: string;
  pattern?: string;
  expression?: RegExp;
}
type FallbackCandidate = { tool: string; command: string };
function decodeRecord(value: unknown): { message?: Message } {
  if (!isRecord(value)) throw new TypeError("Session record must be an object");
  if (!isRecord(value.message)) return {};
  const source = value.message;
  const rawContent = source.content ?? [];
  if (!Array.isArray(rawContent))
    throw new TypeError("Message content must be an array");
  const content = rawContent.map((item: unknown): Content => {
    if (!isRecord(item) || typeof item.type !== "string")
      throw new TypeError("Invalid content");
    return {
      type: item.type,
      text: optionalString(item.text),
      id: optionalString(item.id),
      name: optionalString(item.name),
      arguments: isRecord(item.arguments) ? item.arguments : undefined,
    };
  });
  return {
    message: {
      role: optionalString(source.role),
      content,
      toolName: optionalString(source.toolName),
      toolCallId: optionalString(source.toolCallId),
      isError: source.isError === true,
    },
  };
}

const TOOL_PATTERNS = [
  {
    kind: "nonzero-exit",
    pattern:
      /(?:exited with status|exited with code|Command exited with code)\s+(-?\d+)/iu,
    accepts: (match: RegExpMatchArray) => Number(match[1]) !== 0,
  },
  {
    kind: "unsupported",
    pattern: /未対応|対応していない|unsupported|not supported/iu,
  },
  {
    kind: "stopped",
    pattern: /Stopped at command\s+(\d+)\s+of\s+(\d+)/iu,
  },
];
const FALLBACK_PATTERN =
  /代わりに|代替(?:手段|方法)?|(?:へ|に)切り替え|fallback/iu;
const MAX_CONTEXT_LENGTH = 300;

function parseArguments(argv: readonly string[]) {
  let ignoreFilename: string | undefined;
  let sessionFilename: string | undefined;
  for (const argument of argv) {
    if (argument.startsWith("--ignore=")) {
      if (ignoreFilename) throw new Error("Specify --ignore only once");
      ignoreFilename = argument.slice("--ignore=".length);
    } else if (!sessionFilename) {
      sessionFilename = argument;
    } else {
      throw new Error(`Unknown argument: ${argument}`);
    }
  }
  if (!sessionFilename)
    throw new Error(
      "Usage: verify-session-tools.js [--ignore=<ignore-list.json>] <session.jsonl>",
    );
  return { ignoreFilename, sessionFilename };
}

function readJson(filename: string): unknown {
  return parseJson(fs.readFileSync(filename, "utf8"));
}

function readRecords(filename: string): RecordEntry[] {
  const source = fs.readFileSync(filename, "utf8");
  return source
    .split("\n")
    .map((line, index) => ({ index: index + 1, line }))
    .filter(({ line }) => line.trim() !== "")
    .map(({ index, line }) => ({
      index,
      record: decodeRecord(parseJson(line)),
    }));
}

function readIgnoreList(filename: string | undefined): IgnoreEntry[] {
  if (!filename) return [];
  const source = readJson(filename);
  if (!isRecord(source) || !Array.isArray(source.ignore))
    throw new Error("Ignore list must be a JSON object with an ignore array");
  return source.ignore.map((entry: unknown, index: number) => {
    if (!isRecord(entry))
      throw new Error(`ignore[${index}] must be a JSON object`);
    const allowed = new Set(["kind", "tool", "command", "pattern"]);
    for (const [key, value] of Object.entries(entry)) {
      if (!allowed.has(key))
        throw new Error(`ignore[${index}] has an unknown field: ${key}`);
      if (typeof value !== "string")
        throw new Error(`ignore[${index}].${key} must be a string`);
      if (value.trim() === "")
        throw new Error(`ignore[${index}].${key} must not be empty`);
    }
    if (Object.keys(entry).length === 0)
      throw new Error(`ignore[${index}] must have at least one condition`);
    return {
      kind: optionalString(entry.kind),
      tool: optionalString(entry.tool),
      command: optionalString(entry.command),
      pattern: optionalString(entry.pattern),
      expression:
        typeof entry.pattern === "string"
          ? new RegExp(entry.pattern, "iu")
          : undefined,
    };
  });
}

function textContent(message: Message) {
  return (message?.content ?? [])
    .filter((content) => content.type === "text")
    .map((content) => content.text)
    .join("\n");
}

function shellArgument(value: unknown) {
  const text = String(value);
  return /^[\p{L}\p{N}_./:=,+@%-]+$/u.test(text)
    ? text
    : `'${text.replaceAll("'", `'\\''`)}'`;
}

function toolCommand(tool: string | undefined, arguments_: unknown[]) {
  return `${tool ?? "unknown"} ${arguments_.map(shellArgument).join(" ")}`.trimEnd();
}

function commandFromCall(call: Content | undefined) {
  const arguments_ = call?.arguments;
  if (!arguments_ || typeof arguments_ !== "object") return "unknown";
  if (typeof arguments_.command === "string") return arguments_.command;
  if (Array.isArray(arguments_.args))
    return [call?.name ?? "unknown", ...arguments_.args]
      .map(shellArgument)
      .join(" ");
  if (Array.isArray(arguments_.commands) && arguments_.commands.length === 1) {
    if (!Array.isArray(arguments_.commands[0]))
      throw new TypeError("Invalid command arguments");
    return toolCommand(call?.name, arguments_.commands[0]);
  }
  return `${call?.name ?? "unknown"} ${JSON.stringify(arguments_)}`;
}

function commandAt(call: Content | undefined, position: number) {
  const commands = call?.arguments?.commands;
  if (!Array.isArray(commands) || !Array.isArray(commands[position - 1]))
    return commandFromCall(call);
  return toolCommand(call?.name, commands[position - 1]);
}

function nearestCommand(
  lines: string[],
  lineIndex: number,
  call: Content | undefined,
) {
  for (let index = lineIndex; index >= 0; index -= 1) {
    if (lines[index].startsWith("$ ")) return lines[index].slice(2);
  }
  return commandFromCall(call);
}

function contextAt(lines: string[], lineIndex: number) {
  return lines
    .slice(Math.max(0, lineIndex - 1), lineIndex + 2)
    .map((line) =>
      line.length <= MAX_CONTEXT_LENGTH
        ? line
        : `${line.slice(0, MAX_CONTEXT_LENGTH)}…`,
    );
}

function toolHits(
  recordIndex: number,
  message: Message,
  call: Content | undefined,
) {
  const tool = message.toolName ?? call?.name ?? "unknown";
  const lines = textContent(message).split("\n");
  const hits: Hit[] = [];
  for (const [lineIndex, line] of lines.entries()) {
    for (const candidate of TOOL_PATTERNS) {
      const match = line.match(candidate.pattern);
      if (!match || (candidate.accepts && !candidate.accepts(match))) continue;
      const stoppedAt = candidate.kind === "stopped" ? Number(match[1]) : null;
      hits.push({
        kind: candidate.kind,
        tool,
        command: stoppedAt
          ? commandAt(call, stoppedAt)
          : nearestCommand(lines, lineIndex, call),
        recordIndex,
        text: line,
        context: contextAt(lines, lineIndex),
      });
    }
  }
  const failed = hits.length > 0 || message.isError === true;
  return {
    hits,
    fallbackCandidate: failed
      ? {
          tool,
          command: nearestCommand(lines, lines.length - 1, call),
        }
      : undefined,
  };
}

function fallbackHits(
  recordIndex: number,
  message: Message,
  fallbackCandidate: FallbackCandidate | undefined,
) {
  if (!fallbackCandidate) return [];
  const lines = textContent(message).split("\n");
  return lines.flatMap((line, lineIndex) =>
    FALLBACK_PATTERN.test(line)
      ? [
          {
            kind: "fallback suggested",
            tool: fallbackCandidate.tool,
            command: fallbackCandidate.command,
            recordIndex,
            text: line,
            context: contextAt(lines, lineIndex),
          },
        ]
      : [],
  );
}

function ignored(hit: Hit, ignoreList: IgnoreEntry[]) {
  return ignoreList.some(
    (entry) =>
      (!entry.kind || entry.kind === hit.kind) &&
      (!entry.tool || entry.tool === hit.tool) &&
      (!entry.command || entry.command === hit.command) &&
      (!entry.expression || entry.expression.test(hit.text)),
  );
}

function inspectSession(records: RecordEntry[], ignoreList: IgnoreEntry[]) {
  const calls = new Map<string | undefined, Content>();
  const hits: Hit[] = [];
  let fallbackCandidate: FallbackCandidate | undefined;
  for (const { index, record } of records) {
    const message = record.message;
    if (message?.role === "assistant") {
      for (const content of message.content ?? []) {
        if (content.type === "toolCall") calls.set(content.id, content);
      }
      hits.push(...fallbackHits(index, message, fallbackCandidate));
      fallbackCandidate = undefined;
    }
    if (message?.role === "toolResult") {
      const result = toolHits(index, message, calls.get(message.toolCallId));
      hits.push(...result.hits);
      if (result.fallbackCandidate)
        fallbackCandidate = result.fallbackCandidate;
    }
  }
  return hits.filter((hit) => !ignored(hit, ignoreList));
}

function report(hits: Hit[]) {
  if (hits.length === 0) {
    console.log("No tool failures in session record");
    return;
  }
  console.log(`Detected ${hits.length} tool failures in session record`);
  for (const hit of hits) {
    console.log(`- Kind: ${hit.kind}`);
    console.log(`  Tool: ${hit.tool}`);
    console.log(`  Command: ${hit.command}`);
    console.log(`  Record line: ${hit.recordIndex}`);
    console.log("  Context:");
    for (const line of hit.context) console.log(`    ${line}`);
  }
}

function main(argv: readonly string[]) {
  const { ignoreFilename, sessionFilename } = parseArguments(argv);
  const hits = inspectSession(
    readRecords(sessionFilename),
    readIgnoreList(ignoreFilename),
  );
  report(hits);
  process.exitCode = hits.length === 0 ? 0 : 1;
}

if (require.main === module) {
  try {
    main(process.argv.slice(2));
  } catch (error) {
    console.error(
      `Session record check failed: ${error instanceof Error ? error.message : String(error)}`,
    );
    process.exitCode = 2;
  }
}
