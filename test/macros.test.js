const assert = require('node:assert/strict');
const test = require('node:test');

const { validateAdditionalMacros } = require('../dist/macros.js');

test('macro validation follows TeX hash escaping and parameter references', () => {
  const escaped = validateAdditionalMacros({ hash: '\\#' });
  const errors = [];
  for (const definition of ['##', '#', ['#2', 1]]) {
    try {
      validateAdditionalMacros({ hash: definition });
    } catch (error) {
      errors.push(error instanceof TypeError);
    }
  }

  assert.deepEqual({ escaped, rejectedInvalidDefinitions: errors }, {
    escaped: { hash: '\\#' },
    rejectedInvalidDefinitions: [true, true, true]
  });
});
