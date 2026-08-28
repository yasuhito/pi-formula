export type MathRenderer = (latex: string, display: boolean, original: string) => string;

interface MacroArgument {
  value: string;
  end: number;
}

function readMacroArgument(source: string, start: number): MacroArgument | undefined {
  let opening = start;
  while (/\s/.test(source[opening] ?? "")) opening += 1;
  if (source[opening] !== "{") return undefined;

  let depth = 1;
  for (let index = opening + 1; index < source.length; index += 1) {
    if (source[index] === "\\") {
      index += 1;
      continue;
    }
    if (source[index] === "{") depth += 1;
    if (source[index] === "}") depth -= 1;
    if (depth === 0) {
      return { value: source.slice(opening + 1, index), end: index + 1 };
    }
  }
  return undefined;
}

export function expandQuantumMacros(latex: string): string {
  let expanded = "";

  for (let index = 0; index < latex.length;) {
    const macro = latex.slice(index).match(/^\\(braket|ket|bra)(?![A-Za-z])/);
    if (!macro) {
      expanded += latex[index];
      index += 1;
      continue;
    }

    const first = readMacroArgument(latex, index + macro[0].length);
    const second = macro[1] === "braket" && first
      ? readMacroArgument(latex, first.end)
      : undefined;
    if (!first || (macro[1] === "braket" && !second)) {
      expanded += macro[0];
      index += macro[0].length;
      continue;
    }

    const firstValue = expandQuantumMacros(first.value);
    if (macro[1] === "ket") expanded += `|${firstValue}\\rangle`;
    if (macro[1] === "bra") expanded += `\\langle ${firstValue}|`;
    if (macro[1] === "braket") {
      expanded += `\\langle ${firstValue}|${expandQuantumMacros(second!.value)}\\rangle`;
    }
    index = second?.end ?? first.end;
  }

  return expanded;
}

interface ProtectedMarkdown {
  markdown: string;
  restore: (value: string) => string;
}

function protectCode(markdown: string): ProtectedMarkdown {
  const protectedParts: string[] = [];
  const token = (value: string): string => {
    const index = protectedParts.push(value) - 1;
    return `\u{e000}${index}\u{e001}`;
  };

  const lines = markdown.split(/(?<=\n)/);
  let fenced = false;
  let fenceCharacter = "";
  let fenceLength = 0;
  let fenceQuoteDepth = 0;
  let fencedContent = "";
  let withoutFences = "";

  for (const line of lines) {
    const opening = line.match(/^((?: {0,3}>[ \t]?)* {0,3})(`{3,}|~{3,})/);
    if (!fenced && opening) {
      fenced = true;
      fenceCharacter = opening[2]![0]!;
      fenceLength = opening[2]!.length;
      fenceQuoteDepth = opening[1]!.split(">").length - 1;
      fencedContent = line;
      continue;
    }
    if (fenced) {
      fencedContent += line;
      const quotePrefix = `(?: {0,3}>[ \\t]?){${fenceQuoteDepth}} {0,3}`;
      const closing = new RegExp(`^${quotePrefix}${fenceCharacter}{${fenceLength},}\\s*$`);
      if (closing.test(line.trimEnd())) {
        withoutFences += token(fencedContent);
        fenced = false;
        fencedContent = "";
      }
      continue;
    }
    withoutFences += line;
  }
  if (fencedContent) withoutFences += token(fencedContent);

  let protectedMarkdown = "";
  for (let index = 0; index < withoutFences.length;) {
    if (withoutFences[index] !== "`") {
      protectedMarkdown += withoutFences[index];
      index += 1;
      continue;
    }
    let runLength = 1;
    while (withoutFences[index + runLength] === "`") runLength += 1;
    const delimiter = "`".repeat(runLength);
    const closing = withoutFences.indexOf(delimiter, index + runLength);
    if (closing < 0) {
      protectedMarkdown += delimiter;
      index += runLength;
      continue;
    }
    protectedMarkdown += token(withoutFences.slice(index, closing + runLength));
    index = closing + runLength;
  }

  return {
    markdown: protectedMarkdown,
    restore: (value) => value.replace(/\u{e000}(\d+)\u{e001}/gu, (_match, index: string) =>
      protectedParts[Number.parseInt(index, 10)]!
    )
  };
}

function findClosing(markdown: string, delimiter: string, start: number, multiline: boolean): number {
  for (let index = start; index <= markdown.length - delimiter.length; index += 1) {
    if (!multiline && markdown[index] === "\n") return -1;
    if (markdown.startsWith(delimiter, index) && markdown[index - 1] !== "\\") return index;
  }
  return -1;
}

export function transformMathMarkdown(markdown: string, render: MathRenderer): string {
  const protectedMarkdown = protectCode(markdown);
  const source = protectedMarkdown.markdown;
  let transformed = "";

  for (let index = 0; index < source.length;) {
    let opening: string | undefined;
    let closingDelimiter = "";
    let display = false;

    if (source.startsWith("$$", index) && source[index - 1] !== "\\") {
      opening = "$$";
      closingDelimiter = "$$";
      display = true;
    } else if (source.startsWith("\\[", index)) {
      opening = "\\[";
      closingDelimiter = "\\]";
      display = true;
    } else if (source.startsWith("\\(", index)) {
      opening = "\\(";
      closingDelimiter = "\\)";
    } else if (source[index] === "$" && source[index - 1] !== "\\") {
      opening = "$";
      closingDelimiter = "$";
    }

    if (!opening) {
      transformed += source[index];
      index += 1;
      continue;
    }

    const contentStart = index + opening.length;
    const closing = findClosing(source, closingDelimiter, contentStart, display);
    if (closing < 0 || closing === contentStart) {
      transformed += opening;
      index = contentStart;
      continue;
    }

    const original = source.slice(index, closing + closingDelimiter.length);
    const replacement = render(source.slice(contentStart, closing), display, original);
    transformed += display ? `\n${replacement}\n` : replacement;
    index = closing + closingDelimiter.length;
  }

  return protectedMarkdown.restore(transformed);
}
