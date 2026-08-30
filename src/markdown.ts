interface ProtectedMarkdown {
  markdown: string;
  restore(value: string): string;
}

function protectCode(markdown: string): ProtectedMarkdown {
  const parts: string[] = [];
  const token = (value: string): string => `\u{e000}${parts.push(value) - 1}\u{e001}`;
  const lines = markdown.split(/(?<=\n)/u);
  let fence: {
    character: string;
    length: number;
    quoteDepth: number;
    content: string;
  } | undefined;
  let withoutFences = "";

  for (const line of lines) {
    const opening = line.match(/^((?: {0,3}>[ \t]?)* {0,3})(`{3,}|~{3,})/u);
    if (!fence && opening) {
      fence = {
        character: opening[2]![0]!,
        length: opening[2]!.length,
        quoteDepth: opening[1]!.split(">").length - 1,
        content: line
      };
      continue;
    }
    if (fence) {
      fence.content += line;
      const quotePrefix = `(?: {0,3}>[ \\t]?){${fence.quoteDepth}} {0,3}`;
      const closing = new RegExp(
        `^${quotePrefix}${fence.character}{${fence.length},}\\s*$`, "u"
      );
      if (closing.test(line.trimEnd())) {
        withoutFences += token(fence.content);
        fence = undefined;
      }
      continue;
    }
    const indentedCode = /^(?: {0,3}>[ \t]?)*(?: {4}|\t)/u.test(line);
    withoutFences += indentedCode ? token(line) : line;
  }
  if (fence) withoutFences += token(fence.content);

  let protectedMarkdown = "";
  for (let index = 0; index < withoutFences.length;) {
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
      return value.replace(/\u{e000}(\d+)\u{e001}/gu, (_match, index: string) =>
        parts[Number.parseInt(index, 10)]!
      );
    }
  };
}

function isEscaped(source: string, index: number): boolean {
  let backslashes = 0;
  for (let cursor = index - 1; cursor >= 0 && source[cursor] === "\\"; cursor -= 1) {
    backslashes += 1;
  }
  return backslashes % 2 === 1;
}

function closingIndex(source: string, delimiter: string, start: number): number {
  for (let index = start; index <= source.length - delimiter.length; index += 1) {
    if (source.startsWith(delimiter, index) && !isEscaped(source, index)) return index;
  }
  return -1;
}

export function transformDisplayMath(
  markdown: string,
  render: (latex: string, original: string) => string
): string {
  const protectedMarkdown = protectCode(markdown);
  const source = protectedMarkdown.markdown;
  let transformed = "";

  for (let index = 0; index < source.length;) {
    const opening = source.startsWith("$$", index) && !isEscaped(source, index)
      ? "$$"
      : source.startsWith("\\[", index) && !isEscaped(source, index) ? "\\[" : undefined;
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
    transformed += `\n${render(source.slice(contentStart, closing), original)}\n`;
    index = closing + closingDelimiter.length;
  }

  return protectedMarkdown.restore(transformed);
}
