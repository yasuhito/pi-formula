import { Markdown } from "@earendil-works/pi-tui";

export function longFormulaPlanFixture() {
  const tooLong = `x=${"x".repeat(16_383)}`;
  const corpus = ["$$x$$", `$$${tooLong}$$`].join("\n\n");
  const theme = new Proxy({} as ConstructorParameters<typeof Markdown>[3], {
    get: () => (text: string) => text,
  });
  const textRows = new Markdown(corpus, 0, 0, theme).render(120).length;

  return {
    corpus,
    expectedPlan: {
      // Two history copies: rendered text, two transfer rows, one image row.
      // Pi owns Markdown wrapping, so its row count may change between releases.
      height: 3000 + 2 * ((textRows + 2) * 24 + 20),
      initialWidth: 1920,
      reflowWidth: null,
      imageRows: 1,
      displayFormulas: 2,
      failedFormulas: 1,
    },
  };
}
