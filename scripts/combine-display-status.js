#!/usr/bin/env node

function combineDisplayStatuses(statuses, finalOnly = false) {
  if (!statuses.every((status) => Number.isInteger(status) && status >= 0))
    throw new Error("判定器の終了コードが不正です");
  if (statuses.some((status) => status >= 2)) return 2;
  if (statuses.some((status) => status === 1)) return 1;
  return finalOnly ? 3 : 0;
}

function main(values) {
  const finalOnly = values[0] === "--final-only";
  const statuses = finalOnly ? values.slice(1) : values;
  if (statuses.length === 0)
    throw new Error(
      "Usage: combine-display-status.js [--final-only] <status>...",
    );
  console.log(combineDisplayStatuses(statuses.map(Number), finalOnly));
}

if (require.main === module) {
  try {
    main(process.argv.slice(2));
  } catch (error) {
    console.error(`終了コード統合失敗: ${error.message}`);
    process.exitCode = 2;
  }
}

module.exports = { combineDisplayStatuses };
