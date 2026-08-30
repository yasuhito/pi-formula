const assert = require('node:assert/strict');
const {
  mkdirSync,
  mkdtempSync,
  rmSync,
  symlinkSync,
  writeFileSync
} = require('node:fs');
const { tmpdir } = require('node:os');
const { join } = require('node:path');
const test = require('node:test');

const { commandsFromRealPi, isInside } = require('./support/package-trial');

test('temporary install check resolves directory aliases before comparing paths', () => {
  const temporary = mkdtempSync(join(tmpdir(), 'pi-formula-path-alias-'));
  try {
    const actual = join(temporary, 'actual');
    const alias = join(temporary, 'alias');
    mkdirSync(actual);
    writeFileSync(join(actual, 'api.js'), '');
    symlinkSync(actual, alias, 'dir');

    assert.equal(isInside(alias, join(actual, 'api.js')), true);
  } finally {
    rmSync(temporary, { recursive: true, force: true });
  }
});

test('Pi RPC startup failure returns diagnostics without hanging', { timeout: 2000 }, async () => {
  const startedAt = Date.now();
  const result = await commandsFromRealPi(process.cwd(), process.env, {
    command: 'missing-pi-formula-test-executable',
    responseTimeoutMs: 50,
    terminateTimeoutMs: 50,
    killTimeoutMs: 100
  });

  assert.deepEqual({
    failedToStart: /ENOENT/u.test(result.error ?? ''),
    hasResponse: result.response !== undefined,
    closed: result.closed,
    bounded: Date.now() - startedAt < 1000
  }, {
    failedToStart: true,
    hasResponse: false,
    closed: true,
    bounded: true
  });
});

test('Pi RPC escalates to SIGKILL when the child ignores SIGTERM', { timeout: 2000 }, async () => {
  const startedAt = Date.now();
  const result = await commandsFromRealPi(process.cwd(), process.env, {
    command: process.execPath,
    args: ['--eval', "process.on('SIGTERM', () => {}); setInterval(() => {}, 1000)"],
    responseTimeoutMs: 100,
    terminateTimeoutMs: 50,
    killTimeoutMs: 500
  });

  assert.deepEqual({
    responseTimedOut: result.responseTimedOut,
    sentSigterm: result.sentSigterm,
    sentSigkill: result.sentSigkill,
    closed: result.closed,
    bounded: Date.now() - startedAt < 1500
  }, {
    responseTimedOut: true,
    sentSigterm: true,
    sentSigkill: true,
    closed: true,
    bounded: true
  });
});
