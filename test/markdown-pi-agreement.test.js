const assert = require("node:assert/strict");
const test = require("node:test");
const { Markdown } = require("@earendil-works/pi-tui");

const { transformDisplayMath } = require("../dist/markdown.js");

// Pi の数式 tokenizer は公開されていないため、公開 Markdown component を
// renderLatex の on/off で描き分け、出力が変わるかどうかで Pi の判定を読む。
// Pi が描画できない LaTeX は両モードとも原文へ落ちるので、この読み方では
// 「数式でない」と区別が付かない。fixture は描画できる式だけで作る。
const identity = (text) => text;
const THEME = Object.fromEntries(
  [
    "heading",
    "link",
    "linkUrl",
    "code",
    "codeBlock",
    "codeBlockBorder",
    "quote",
    "quoteBorder",
    "hr",
    "listBullet",
    "bold",
    "italic",
    "strikethrough",
    "underline",
  ].map((name) => [name, identity]),
);

function piSeesMath(markdown) {
  const render = (renderLatex) =>
    new Markdown(markdown, 0, 0, THEME, undefined, { renderLatex })
      .render(80)
      .join("\n");
  return render(true) !== render(false);
}

function displayFormulasIn(markdown) {
  const rendered = [];
  transformDisplayMath(markdown, (latex) => {
    rendered.push(latex);
    return "<image>";
  });
  return rendered;
}

// pi-formula が画像にした式のうち、Pi は本文として残したものを返す。
// 画像化した件数が合っていても中身がずれる退行（#68）を捕まえる。
function formulasPiKeptAsText(markdown) {
  const consumed = [];
  transformDisplayMath(markdown, (latex, original) => {
    consumed.push({ latex, original });
    return "<image>";
  });
  const withMath = new Markdown(markdown, 0, 0, THEME, undefined, {
    renderLatex: true,
  })
    .render(120)
    .join("\n");
  return consumed
    .filter(({ original }) => withMath.includes(original.split("\n")[0]))
    .map(({ latex }) => latex);
}

// Pi が数式と見なさない入力。pi-formula が画像にすると、利用者には
// 金額や URL が数式へ化けて見える。#56 と #68 がこの退行だった。
const PLAIN_FOR_PI = [
  ["単独の金額", "$5 and $10"],
  [
    "文中の金額と URL とエスケープ",
    "It costs $5 or $10. https://example.com/$5 uses $HOME and \\$5.",
  ],
  ["シェル変数と裸のドル記号", "$HOME and $"],
  ["ドル記号で始まる語", "The values are $first and $second, not a formula."],
  ["ドル二つで始まる金額", "価格は $$100 です。"],
  ["金額とインライン記法の混在", "価格は $5、状態は |s⟩。\n$HOME の後は |t⟩。"],
  ["前置きのドル二つと金額", "前置き $$ は数式ではありません。\n$$100 です。"],
  ["URL 内のシェル変数", "https://example.com/$HOME の後は |s⟩"],
  ["URL 内のドル二つ", "https://example.com/a$$b$$c"],
  ["コード内の表示数式風", "`$$inline$$`"],
  ["コード内のインライン数式風", "inline: `$\\ket{s}$`"],
  ["行頭のドル二つを含む本文", "$$通常本文\n"],
  ["ドル記号の直後が空白", "$ x $"],
];

// pi-formula が意図して Pi より広く画像にする入力。Pi の block tokenizer は
// `^ {0,3}$$` なので、箇条書きや引用でインデントされた内容には一致しない。
// features/markdown.feature.md に対応するシナリオがある。
const PI_FORMULA_ONLY = [
  ["箇条書きの中", "- 外側\n  - 式: $$\n    x^2\n    $$", "\nx^2\n"],
  ["引用の中", "> 式: \\[\n> x^2\n> \\]", "\nx^2\n"],
];

// Pi と pi-formula がどちらも数式と見る入力。pi-formula が画像にした式は
// Pi も数式として消費していなければならない。件数だけ合って中身がずれる
// 退行を、消費した原文が Pi の描画に残るかどうかで見分ける。
const AGREES_WITH_PI = [
  ["単独の表示数式", "$$x = 1$$"],
  ["数値だけの表示数式", "$$100$$"],
  ["数値の表示数式と後続の表示数式", "$$42$$ と $$x = 1$$"],
  ["ラベル直後の表示数式", "Result:$$x = 1$$"],
  ["コロン直後の表示数式", "考える: $$x$$"],
  [
    "数式でないドル二つの後の表示数式",
    "run echo $$; kill $$ after 2 seconds.\n\n$$x = 1$$",
  ],
  [
    "改行を挟むドル二つの後の表示数式",
    "run echo $$;\nkill $$ after 2 seconds.\n\n$$x = 1$$",
  ],
  [
    "前置きのドル二つと金額の後の表示数式",
    "前置き $$ は数式ではありません。\n$$100 です。\n\n$$x = 1$$",
  ],
  [
    "金額の後の表示数式",
    "前置き $$ は数式ではありません。\n価格は $$100\n\n$$x = 1$$",
  ],
];

test("oracle が表示数式を数式として読む", () => {
  assert.equal(piSeesMath("$$x^2$$"), true);
});

test("oracle が金額を数式として読まない", () => {
  assert.equal(piSeesMath("$$100"), false);
});

test("fixture の入力を Pi はいずれも数式と見なさない", () => {
  assert.deepEqual(
    PLAIN_FOR_PI.filter(([, markdown]) => piSeesMath(markdown)).map(
      ([name]) => name,
    ),
    [],
  );
});

for (const [name, markdown] of PLAIN_FOR_PI) {
  test(`Pi が数式と見なさない${name}を表示数式にしない`, () => {
    assert.deepEqual(displayFormulasIn(markdown), []);
  });
}

for (const [name, markdown] of AGREES_WITH_PI) {
  test(`${name}で Pi が本文として残した式を画像にしない`, () => {
    assert.deepEqual(formulasPiKeptAsText(markdown), []);
  });
}

for (const [name, markdown, expected] of PI_FORMULA_ONLY) {
  test(`Pi が数式と見なさない${name}の表示数式を意図して画像にする`, () => {
    assert.deepEqual(displayFormulasIn(markdown), [expected]);
  });
}
