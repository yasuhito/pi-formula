import { Markdown } from "@earendil-works/pi-tui";

export function longFormulaPlanFixture() {
  const tooLong = `x=${"x".repeat(16_383)}`;
  const corpus = ["$$x$$", `$$${tooLong}$$`].join("\n\n");
  const theme = new Proxy({} as ConstructorParameters<typeof Markdown>[3], {
    get: () => (text: string) => text,
  });
  const piMarkdownRows = new Markdown(corpus, 0, 0, theme).render(120).length;
  const transferRows = 2;
  const historyCopies = 2;
  const pixelsPerRow = 24;
  const historyPaddingPx = 20;
  const captureChromePx = 3000;
  const historyHeightPx =
    (piMarkdownRows + transferRows) * pixelsPerRow + historyPaddingPx;

  return {
    corpus,
    expectedPlan: {
      height: captureChromePx + historyCopies * historyHeightPx,
      initialWidth: 1920,
      reflowWidth: null,
      imageRows: 1,
      displayFormulas: 2,
      failedFormulas: 1,
    },
  };
}
