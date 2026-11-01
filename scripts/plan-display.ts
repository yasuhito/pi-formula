#!/usr/bin/env node

import fs from "node:fs";
import { Markdown } from "@earendil-works/pi-tui";
import { transformDisplayMath } from "../dist/markdown.js";
import { MINIMUM_READABLE_SCALE, typesetMath } from "../dist/typesetter.js";
import { VERIFY_DISPLAY_MACROS } from "./verify-display-macros.js";

export type DisplayPath = "image" | "text";
export interface DisplayPlanOptions {
  source?: boolean;
  path?: DisplayPath;
  reflow?: number | null;
}

const MIN_HEIGHT = 8000;
const MAX_HEIGHT = 16000;
const FIXED_UI_HEIGHT = 3000;
const TEXT_LINE_HEIGHT = 24;
const IMAGE_ROW_HEIGHT = 20;
const HISTORY_COPIES = 2;
const INITIAL_WIDTH = 1920;
const INITIAL_TEXT_COLUMNS = 120;
const INITIAL_IMAGE_COLUMNS = 220;
const CELL = Object.freeze({ widthPx: 8, heightPx: 16 });
const identity = (text: string) => text;
const PLAN_THEME = Object.freeze({
  heading: identity,
  link: identity,
  linkUrl: identity,
  code: identity,
  codeBlock: identity,
  codeBlockBorder: identity,
  quote: identity,
  quoteBorder: identity,
  hr: identity,
  listBullet: identity,
  bold: identity,
  italic: identity,
  strikethrough: identity,
  underline: identity,
});

function renderedTextRows(markdown: string, columns: number) {
  return new Markdown(markdown, 0, 0, PLAN_THEME).render(columns).length;
}

function planForWidth(
  markdown: string,
  rendering: { path: DisplayPath; textColumns: number; imageColumns: number },
) {
  let displayFormulas = 0;
  let failedFormulas = 0;
  let imageRows = 0;
  transformDisplayMath(markdown, (latex, original) => {
    displayFormulas += 1;
    if (rendering.path === "image") {
      try {
        const image = typesetMath(
          latex,
          "#282823",
          rendering.imageColumns,
          CELL,
          VERIFY_DISPLAY_MACROS,
        );
        if (image.scale < MINIMUM_READABLE_SCALE) {
          failedFormulas += 1;
        } else {
          imageRows += image.rows;
        }
      } catch {
        failedFormulas += 1;
      }
    }
    return original;
  });
  const textRows = renderedTextRows(markdown, rendering.textColumns);
  const successfulFormulas = displayFormulas - failedFormulas;
  const imageTransportRows =
    rendering.path === "image" ? successfulFormulas * 2 : 0;
  const requiredHeight =
    FIXED_UI_HEIGHT +
    HISTORY_COPIES *
      ((textRows + imageTransportRows) * TEXT_LINE_HEIGHT +
        imageRows * IMAGE_ROW_HEIGHT);
  return { requiredHeight, imageRows, displayFormulas, failedFormulas };
}

export function planDisplay(input: string, options: DisplayPlanOptions = {}) {
  const markdown = options.source ? input : fs.readFileSync(input, "utf8");
  const displayPath = options.path ?? "image";
  const reflow = options.reflow ?? null;
  const initialPlan = planForWidth(markdown, {
    path: displayPath,
    textColumns: INITIAL_TEXT_COLUMNS,
    imageColumns: INITIAL_IMAGE_COLUMNS,
  });
  const reflowPlan =
    reflow === null
      ? null
      : planForWidth(markdown, {
          path: displayPath,
          textColumns: reflow,
          imageColumns: reflow,
        });
  const tallestPlan =
    reflowPlan !== null &&
    reflowPlan.requiredHeight >= initialPlan.requiredHeight
      ? { ...reflowPlan, label: `${reflow}列へのリフロー後` }
      : { ...initialPlan, label: `通常幅${INITIAL_WIDTH}px` };
  if (tallestPlan.requiredHeight > MAX_HEIGHT) {
    const pathLabel = displayPath === "image" ? "画像経路" : "テキスト経路";
    throw new Error(
      `${tallestPlan.label}（${pathLabel}）には ${tallestPlan.requiredHeight}px 必要なため ${MAX_HEIGHT}px に収まりません`,
    );
  }
  return {
    height: Math.max(MIN_HEIGHT, Math.ceil(tallestPlan.requiredHeight)),
    initialWidth: INITIAL_WIDTH,
    reflowWidth: reflow === null ? null : reflow * CELL.widthPx + 16,
    imageRows: Math.max(initialPlan.imageRows, reflowPlan?.imageRows ?? 0),
    displayFormulas: initialPlan.displayFormulas,
    failedFormulas: Math.max(
      initialPlan.failedFormulas,
      reflowPlan?.failedFormulas ?? 0,
    ),
  };
}

function main() {
  const corpus = process.argv[2];
  if (!corpus) {
    console.error("Usage: plan-display.js <corpus.md>");
    process.exitCode = 2;
    return;
  }
  try {
    process.stdout.write(`${JSON.stringify(planDisplay(corpus))}\n`);
  } catch (error) {
    console.error(
      `表示計画失敗: ${error instanceof Error ? error.message : String(error)}`,
    );
    process.exitCode = 2;
  }
}

if (require.main === module) main();
