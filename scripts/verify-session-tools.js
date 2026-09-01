#!/usr/bin/env node

const fs = require("node:fs");

const TOOL_PATTERNS = [
  {
    kind: "非 0 終了",
    pattern:
      /(?:exited with status|exited with code|Command exited with code)\s+(-?\d+)/iu,
    accepts: (match) => Number(match[1]) !== 0,
  },
  {
    kind: "機能不足",
    pattern: /未対応|対応していない|unsupported|not supported/iu,
  },
  {
    kind: "途中停止",
    pattern: /Stopped at command\s+(\d+)\s+of\s+(\d+)/iu,
  },
];
const FALLBACK_PATTERN =
  /代わりに|代替(?:手段|方法)?|(?:へ|に)切り替え|fallback/iu;
const MAX_CONTEXT_LENGTH = 300;

function parseArguments(argv) {
  let ignoreFilename;
  let sessionFilename;
  for (const argument of argv) {
    if (argument.startsWith("--ignore=")) {
      if (ignoreFilename)
        throw new Error("--ignore は一度だけ指定してください");
      ignoreFilename = argument.slice("--ignore=".length);
    } else if (!sessionFilename) {
      sessionFilename = argument;
    } else {
      throw new Error(`不明な引数です: ${argument}`);
    }
  }
  if (!sessionFilename)
    throw new Error(
      "Usage: verify-session-tools.js [--ignore=<ignore-list.json>] <session.jsonl>",
    );
  return { ignoreFilename, sessionFilename };
}

function readJson(filename) {
  return JSON.parse(fs.readFileSync(filename, "utf8"));
}

function readRecords(filename) {
  const source = fs.readFileSync(filename, "utf8");
  return source
    .split("\n")
    .map((line, index) => ({ index: index + 1, line }))
    .filter(({ line }) => line.trim() !== "")
    .map(({ index, line }) => ({ index, record: JSON.parse(line) }));
}

function readIgnoreList(filename) {
  if (!filename) return [];
  const source = readJson(filename);
  if (!source || !Array.isArray(source.ignore))
    throw new Error(
      "無視リストは ignore 配列を持つ JSON object にしてください",
    );
  return source.ignore.map((entry, index) => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry))
      throw new Error(`ignore[${index}] は JSON object にしてください`);
    const allowed = new Set(["kind", "tool", "command", "pattern"]);
    for (const [key, value] of Object.entries(entry)) {
      if (!allowed.has(key))
        throw new Error(`ignore[${index}] に不明な項目があります: ${key}`);
      if (typeof value !== "string")
        throw new Error(`ignore[${index}].${key} は文字列にしてください`);
      if (value.trim() === "")
        throw new Error(`ignore[${index}].${key} は空文字にできません`);
    }
    if (Object.keys(entry).length === 0)
      throw new Error(`ignore[${index}] は条件を一つ以上持たせてください`);
    return {
      ...entry,
      expression: entry.pattern ? new RegExp(entry.pattern, "iu") : undefined,
    };
  });
}

function textContent(message) {
  return (message?.content ?? [])
    .filter((content) => content.type === "text")
    .map((content) => content.text)
    .join("\n");
}

function shellArgument(value) {
  const text = String(value);
  return /^[\p{L}\p{N}_./:=,+@%-]+$/u.test(text)
    ? text
    : `'${text.replaceAll("'", `'\\''`)}'`;
}

function qniCommand(arguments_) {
  return `qni ${arguments_.map(shellArgument).join(" ")}`.trimEnd();
}

function commandFromCall(call) {
  const arguments_ = call?.arguments;
  if (!arguments_ || typeof arguments_ !== "object") return "不明";
  if (typeof arguments_.command === "string") return arguments_.command;
  if (Array.isArray(arguments_.args))
    return [call.name, ...arguments_.args].map(shellArgument).join(" ");
  if (Array.isArray(arguments_.commands) && arguments_.commands.length === 1)
    return qniCommand(arguments_.commands[0]);
  return `${call.name ?? "不明"} ${JSON.stringify(arguments_)}`;
}

function commandAt(call, position) {
  const commands = call?.arguments?.commands;
  if (!Array.isArray(commands) || !Array.isArray(commands[position - 1]))
    return commandFromCall(call);
  return qniCommand(commands[position - 1]);
}

function nearestCommand(lines, lineIndex, call) {
  for (let index = lineIndex; index >= 0; index -= 1) {
    if (lines[index].startsWith("$ ")) return lines[index].slice(2);
  }
  return commandFromCall(call);
}

function contextAt(lines, lineIndex) {
  return lines
    .slice(Math.max(0, lineIndex - 1), lineIndex + 2)
    .map((line) =>
      line.length <= MAX_CONTEXT_LENGTH
        ? line
        : `${line.slice(0, MAX_CONTEXT_LENGTH)}…`,
    );
}

function toolHits(recordIndex, message, call) {
  const tool = message.toolName ?? call?.name ?? "不明";
  const lines = textContent(message).split("\n");
  const hits = [];
  for (const [lineIndex, line] of lines.entries()) {
    for (const candidate of TOOL_PATTERNS) {
      const match = line.match(candidate.pattern);
      if (!match || (candidate.accepts && !candidate.accepts(match))) continue;
      const stoppedAt = candidate.kind === "途中停止" ? Number(match[1]) : null;
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

function fallbackHits(recordIndex, message, fallbackCandidate) {
  if (!fallbackCandidate) return [];
  const lines = textContent(message).split("\n");
  return lines.flatMap((line, lineIndex) =>
    FALLBACK_PATTERN.test(line)
      ? [
          {
            kind: "代替手段",
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

function ignored(hit, ignoreList) {
  return ignoreList.some(
    (entry) =>
      (!entry.kind || entry.kind === hit.kind) &&
      (!entry.tool || entry.tool === hit.tool) &&
      (!entry.command || entry.command === hit.command) &&
      (!entry.expression || entry.expression.test(hit.text)),
  );
}

function inspectSession(records, ignoreList) {
  const calls = new Map();
  const hits = [];
  let fallbackCandidate;
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

function report(hits) {
  if (hits.length === 0) {
    console.log("セッション記録にツール失敗はありません");
    return;
  }
  console.log(`セッション記録のツール失敗を ${hits.length} 件検出しました`);
  for (const hit of hits) {
    console.log(`- 種類: ${hit.kind}`);
    console.log(`  ツール: ${hit.tool}`);
    console.log(`  コマンド: ${hit.command}`);
    console.log(`  記録行: ${hit.recordIndex}`);
    console.log("  文脈:");
    for (const line of hit.context) console.log(`    ${line}`);
  }
}

function main(argv) {
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
    console.error(`セッション記録検査失敗: ${error.message}`);
    process.exitCode = 2;
  }
}
