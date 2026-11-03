import { readdirSync } from "node:fs";
import { basename, join } from "node:path";

interface SerifCandidate {
  family: string;
  files: readonly RegExp[];
}

const SERIF_CANDIDATES: readonly SerifCandidate[] = [
  {
    family: "Noto Serif CJK JP",
    files: [
      /^NotoSerifCJK-Regular\.ttc$/iu,
      /^NotoSerifCJKjp(?:-Regular|-VF)?\.(?:otf|ttf|ttc)$/iu,
    ],
  },
  {
    family: "Source Han Serif JP",
    files: [/^SourceHanSerifJP-?Regular\.(?:otf|ttf|ttc)$/iu],
  },
  {
    family: "Source Han Serif",
    files: [/^SourceHanSerif-?Regular\.(?:otf|ttf|ttc)$/iu],
  },
  {
    family: "IPAexMincho",
    files: [/^(?:ipaexm|IPAexMincho)\.(?:otf|ttf|ttc)$/iu],
  },
];

let selected: string | undefined;
let inspected = false;

function dataFontDirectories(): string[] {
  const home = process.env.HOME;
  const xdgHome =
    process.env.XDG_DATA_HOME ?? (home && join(home, ".local/share"));
  const xdgDirectories = (
    process.env.XDG_DATA_DIRS ?? "/usr/local/share:/usr/share"
  )
    .split(":")
    .filter(Boolean)
    .map((directory) => join(directory, "fonts"));
  return [
    ...(xdgHome ? [join(xdgHome, "fonts")] : []),
    ...(home ? [join(home, ".fonts"), join(home, "Library/Fonts")] : []),
    ...xdgDirectories,
    "/Library/Fonts",
    "/System/Library/Fonts",
    ...(process.env.WINDIR ? [join(process.env.WINDIR, "Fonts")] : []),
  ];
}

function readableDirectoryEntries(directory: string) {
  try {
    return readdirSync(directory, { withFileTypes: true });
  } catch {
    return [];
  }
}

function fontFilesUnder(root: string): string[] {
  const files: string[] = [];
  const pending = [root];
  while (pending.length > 0) {
    const directory = pending.pop();
    if (!directory) continue;
    for (const entry of readableDirectoryEntries(directory)) {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) pending.push(path);
      else if (entry.isFile()) files.push(path);
    }
  }
  return files;
}

function selectFormulaSerifFamily(
  fontFiles: readonly string[],
): string | undefined {
  const fileNames = fontFiles.map((path) => basename(path));
  return SERIF_CANDIDATES.find((candidate) =>
    candidate.files.some((pattern) =>
      fileNames.some((fileName) => pattern.test(fileName)),
    ),
  )?.family;
}

export function formulaSerifFamily(): string | undefined {
  if (!inspected) {
    const fontFiles = dataFontDirectories().flatMap(fontFilesUnder);
    selected = selectFormulaSerifFamily(fontFiles);
    inspected = true;
  }
  return selected;
}

export function formulaSerifStatus(): string {
  return formulaSerifFamily() ?? "system fallback";
}
