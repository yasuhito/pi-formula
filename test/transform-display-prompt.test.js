const assert = require("node:assert/strict");
const test = require("node:test");

const {
  DISPLAY_PROMPT_PREFIX,
  transformDisplayPrompt,
} = require("../scripts/transform-display-prompt");

for (const prompt of [
  "- 箇条書きで説明してください",
  "@記号から始めて説明してください",
]) {
  test(`CLI 記法と衝突する「${prompt[0]}」をそのまま送る`, () => {
    assert.deepEqual(
      transformDisplayPrompt(`${DISPLAY_PROMPT_PREFIX}${prompt}`),
      {
        action: "transform",
        text: prompt,
      },
    );
  });
}
