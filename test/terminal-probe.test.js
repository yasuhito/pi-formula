const assert = require('node:assert/strict');
const test = require('node:test');

const { probePngSupport } = require('../dist/terminal-probe.js');

test('a partial PNG response returns preceding user input before timing out', async () => {
  let listener;
  let query;
  const tui = {
    addInputListener(value) {
      listener = value;
      return () => { listener = undefined; };
    },
    terminal: { write(value) { query = value; } }
  };

  const result = probePngSupport(tui);
  const imageId = /i=(\d+)/u.exec(query)[1];
  const handled = listener(`typed-before\x1b_Gi=${imageId}`);

  assert.deepEqual({ handled, probe: await result }, {
    handled: { data: 'typed-before' },
    probe: { path: 'text', reason: 'PNG query timed out', response: 'timeout' }
  });
});
