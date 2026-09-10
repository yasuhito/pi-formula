export interface TerminalColors {
  foreground?: string;
  background?: string;
}

export interface ResolvedFormulaColor {
  value: string | undefined;
  source: "terminal foreground" | "Pi theme";
}

export function rgbFromAnsi(ansi: string): string | undefined {
  const match = ansi.match(
    /(?:^|[;[])38;2;(\d{1,3});(\d{1,3});(\d{1,3})(?=m|;)/u,
  );
  if (!match) return undefined;
  const channels = match.slice(1).map(Number);
  if (channels.some((channel) => !Number.isInteger(channel) || channel > 255)) {
    return undefined;
  }
  return `#${channels.map((channel) => channel.toString(16).padStart(2, "0")).join("")}`;
}

function relativeLuminance(color: string): number {
  const channels = color
    .slice(1)
    .match(/../gu)
    ?.map((value) => Number.parseInt(value, 16) / 255);
  if (channels?.length !== 3) return 0;
  const [red, green, blue] = channels.map((channel) =>
    channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4,
  );
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
}

function contrastRatio(first: string, second: string): number {
  const brighter = Math.max(
    relativeLuminance(first),
    relativeLuminance(second),
  );
  const darker = Math.min(relativeLuminance(first), relativeLuminance(second));
  return (brighter + 0.05) / (darker + 0.05);
}

function mismatchesBackground(
  themeColor: string,
  terminalColors: TerminalColors,
): boolean {
  return Boolean(
    terminalColors.foreground &&
      terminalColors.background &&
      contrastRatio(themeColor, terminalColors.background) < 2,
  );
}

export function resolveFormulaColor(
  themeColor: string | undefined,
  terminalColors: TerminalColors,
): ResolvedFormulaColor {
  if (
    terminalColors.foreground &&
    (!themeColor || mismatchesBackground(themeColor, terminalColors))
  ) {
    return {
      value: terminalColors.foreground,
      source: "terminal foreground",
    };
  }
  return { value: themeColor, source: "Pi theme" };
}
