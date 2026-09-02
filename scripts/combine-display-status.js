#!/usr/bin/env node

function combineDisplayStatuses(statuses) {
  if (!statuses.every((status) => Number.isInteger(status) && status >= 0))
    throw new Error("判定器の終了コードが不正です");
  if (statuses.some((status) => status >= 2)) return 2;
  if (statuses.some((status) => status === 1)) return 1;
  return 0;
}

function main(values) {
  if (values.length === 0)
    throw new Error("Usage: combine-display-status.js <status>...");
  console.log(combineDisplayStatuses(values.map(Number)));
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
