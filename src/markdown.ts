interface ProtectedMarkdown {
  markdown: string;
  restore(value: string): string;
}

interface MarkdownHierarchy {
  quote: string;
  indent: string;
  marker: string;
  consumed: number;
  continuation: string;
}

function markdownHierarchy(value: string): MarkdownHierarchy {
  const match =
    /^((?: {0,3}>[ \t]?)*)([ \t]*)((?:[-+*]|\d{1,9}[.)])[ \t]+(?:\[[ xX]\][ \t]+)?)?/u.exec(
      value,
    );
  const quote = match?.[1] ?? "";
  const indent = match?.[2] ?? "";
  const marker = match?.[3] ?? "";
  return {
    quote,
    indent,
    marker,
    consumed: quote.length + indent.length + marker.length,
    continuation: `${quote}${indent}${" ".repeat(marker.length)}`,
  };
}

function indentationWidth(value: string): number {
  return Array.from(value).reduce(
    (width, character) => width + (character === "\t" ? 4 : 1),
    0,
  );
}

function isFenceClosingCandidate(
  candidate: string,
  character: string,
  minimumLength: number,
): boolean {
  const value = candidate.trimEnd();
  let delimiterStart = 0;
  while (value[delimiterStart] === " ") delimiterStart += 1;
  if (delimiterStart > 3 || value.length - delimiterStart < minimumLength) {
    return false;
  }
  for (let index = delimiterStart; index < value.length; index += 1) {
    if (value[index] !== character) return false;
  }
  return true;
}

function protectCode(markdown: string): ProtectedMarkdown {
  const parts: string[] = [];
  const token = (value: string): string =>
    `\u{e000}${parts.push(value) - 1}\u{e001}`;
  const lines = markdown.split(/(?<=\n)/u);
  let fence:
    | {
        character: string;
        length: number;
        continuation: string;
        content: string;
      }
    | undefined;
  const listContinuations = new Map<string, number[]>();
  let withoutFences = "";

  for (const line of lines) {
    if (fence) {
      fence.content += line;
      const candidate = line.startsWith(fence.continuation)
        ? line.slice(fence.continuation.length)
        : "";
      if (isFenceClosingCandidate(candidate, fence.character, fence.length)) {
        withoutFences += token(fence.content);
        fence = undefined;
      }
      continue;
    }

    const fenceRun = line.match(/`{3,}|~{3,}/u);
    if (fenceRun?.index !== undefined) {
      const beforeFence = line.slice(0, fenceRun.index);
      const hierarchy = markdownHierarchy(beforeFence);
      const insideList = (listContinuations.get(hierarchy.quote) ?? []).some(
        (width) => width <= indentationWidth(hierarchy.indent),
      );
      const validIndent = indentationWidth(hierarchy.indent) <= 3 || insideList;
      if (hierarchy.consumed === beforeFence.length && validIndent) {
        fence = {
          character: fenceRun[0].charAt(0),
          length: fenceRun[0].length,
          continuation: hierarchy.continuation,
          content: line,
        };
        continue;
      }
    }

    const hierarchy = markdownHierarchy(line);
    const indent = indentationWidth(hierarchy.indent);
    if (line.trim()) {
      for (const quote of listContinuations.keys()) {
        if (quote !== hierarchy.quote) listContinuations.delete(quote);
      }
    }
    let activeLists = listContinuations.get(hierarchy.quote) ?? [];
    if (hierarchy.marker) {
      activeLists = activeLists.filter((width) => width <= indent);
      activeLists.push(indent + hierarchy.marker.length);
      listContinuations.set(hierarchy.quote, activeLists);
    } else if (line.trim()) {
      activeLists = activeLists.filter((width) => width <= indent);
      listContinuations.set(hierarchy.quote, activeLists);
    }
    const listContent = activeLists.some((width) => width <= indent);
    const indentedCode = indent >= 4 && !listContent;
    withoutFences += indentedCode ? token(line) : line;
  }
  if (fence) withoutFences += token(fence.content);

  let protectedMarkdown = "";
  for (let index = 0; index < withoutFences.length; ) {
    if (withoutFences[index] !== "`") {
      protectedMarkdown += withoutFences[index];
      index += 1;
      continue;
    }
    let length = 1;
    while (withoutFences[index + length] === "`") length += 1;
    const delimiter = "`".repeat(length);
    const closing = withoutFences.indexOf(delimiter, index + length);
    if (closing < 0) {
      protectedMarkdown += delimiter;
      index += length;
      continue;
    }
    protectedMarkdown += token(withoutFences.slice(index, closing + length));
    index = closing + length;
  }

  return {
    markdown: protectedMarkdown,
    restore(value) {
      return value.replace(
        /\u{e000}(\d+)\u{e001}/gu,
        (match, index: string) => parts[Number.parseInt(index, 10)] ?? match,
      );
    },
  };
}

function isEscaped(source: string, index: number): boolean {
  let backslashes = 0;
  for (
    let cursor = index - 1;
    cursor >= 0 && source[cursor] === "\\";
    cursor -= 1
  ) {
    backslashes += 1;
  }
  return backslashes % 2 === 1;
}

function closingIndex(
  source: string,
  delimiter: string,
  start: number,
): number {
  for (
    let index = start;
    index <= source.length - delimiter.length;
    index += 1
  ) {
    if (source.startsWith(delimiter, index) && !isEscaped(source, index))
      return index;
  }
  return -1;
}

function hierarchyContinuation(source: string, openingIndex: number): string {
  const lineStart = source.lastIndexOf("\n", openingIndex - 1) + 1;
  return markdownHierarchy(source.slice(lineStart, openingIndex)).continuation;
}

function isUrlDollar(source: string, openingIndex: number): boolean {
  const tokenStart =
    Math.max(
      source.lastIndexOf(" ", openingIndex - 1),
      source.lastIndexOf("\n", openingIndex - 1),
      source.lastIndexOf("\t", openingIndex - 1),
    ) + 1;
  return /(?:[a-z][a-z0-9+.-]*:\/\/|www\.)\S*$/iu.test(
    source.slice(tokenStart, openingIndex),
  );
}

function looksLikeDollarDisplay(latex: string): boolean {
  const value = latex.trim();
  if (!value) return false;
  if (/\\[A-Za-z]/u.test(value)) return true;
  if (/;|&&|\|\|/u.test(value)) return false;
  if (/^\p{L}$/u.test(value)) return true;
  return /[\d_^=+*/<>()[\]|&±≤≥≠≈∈→⇒∞∫∑√-]/u.test(value);
}

function removeContinuation(latex: string, continuation: string): string {
  if (!continuation) return latex;
  return latex
    .split("\n")
    .map((line, index) =>
      index > 0 && line.startsWith(continuation)
        ? line.slice(continuation.length)
        : line,
    )
    .join("\n");
}

function keepHierarchy(rendered: string, continuation: string): string {
  if (!continuation) return rendered;
  return rendered
    .split("\n")
    .map((line) => `${continuation}${line}`)
    .join("\n");
}

export function transformDisplayMath(
  markdown: string,
  render: (latex: string, original: string) => string,
): string {
  const protectedMarkdown = protectCode(markdown);
  const source = protectedMarkdown.markdown;
  let transformed = "";

  for (let index = 0; index < source.length; ) {
    const opening =
      source.startsWith("$$", index) && !isEscaped(source, index)
        ? "$$"
        : source.startsWith("\\[", index) && !isEscaped(source, index)
          ? "\\["
          : undefined;
    if (!opening) {
      transformed += source[index];
      index += 1;
      continue;
    }
    const closingDelimiter = opening === "$$" ? "$$" : "\\]";
    const contentStart = index + opening.length;
    const closing = closingIndex(source, closingDelimiter, contentStart);
    if (closing < 0 || closing === contentStart) {
      transformed += opening;
      index = contentStart;
      continue;
    }
    const original = source.slice(index, closing + closingDelimiter.length);
    const continuation = hierarchyContinuation(source, index);
    const latex = removeContinuation(
      source.slice(contentStart, closing),
      continuation,
    );
    if (
      opening === "$$" &&
      (isUrlDollar(source, index) || !looksLikeDollarDisplay(latex))
    ) {
      transformed += original;
      index = closing + closingDelimiter.length;
      continue;
    }
    const rendered = render(latex, original);
    transformed +=
      rendered === original
        ? original
        : `\n${keepHierarchy(rendered, continuation)}\n`;
    index = closing + closingDelimiter.length;
  }

  return protectedMarkdown.restore(transformed);
}
