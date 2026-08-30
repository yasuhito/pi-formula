const { realpathSync } = require('node:fs');
const { spawn } = require('node:child_process');
const { isAbsolute, relative } = require('node:path');

function isInside(directory, path) {
  const route = relative(realpathSync(directory), realpathSync(path));
  return route !== '' && !route.startsWith('..') && !isAbsolute(route);
}

function delay(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function waitUntil(condition, closed, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (!condition() && !closed()) {
    const remaining = deadline - Date.now();
    if (remaining <= 0) break;
    await delay(Math.min(25, remaining));
  }
  return condition();
}

function rpcResponse(stdout) {
  return stdout.split('\n').filter(Boolean).flatMap((line) => {
    try {
      return [JSON.parse(line)];
    } catch {
      return [];
    }
  }).find((event) => event.command === 'get_commands');
}

async function commandsFromRealPi(cwd, env, options = {}) {
  const command = options.command ?? 'pi';
  const args = options.args ?? [
    '--mode', 'rpc', '--no-session', '--offline', '--no-context-files',
    '--no-skills', '--no-prompt-templates', '--no-themes'
  ];
  const responseTimeoutMs = options.responseTimeoutMs ?? 10_000;
  const terminateTimeoutMs = options.terminateTimeoutMs ?? 500;
  const killTimeoutMs = options.killTimeoutMs ?? 500;
  const agent = spawn(command, args, { cwd, env, stdio: ['pipe', 'pipe', 'pipe'] });
  const state = {
    closed: false,
    sentSigterm: false,
    sentSigkill: false
  };
  let stdout = '';
  let stderr = '';
  let spawnError;
  let stdinError;
  agent.stdout.on('data', (chunk) => { stdout += chunk; });
  agent.stderr.on('data', (chunk) => { stderr += chunk; });
  agent.on('error', (error) => { spawnError = error; });
  agent.stdin.on('error', (error) => { stdinError = error; });
  agent.on('close', (code, signal) => {
    state.closed = true;
    state.code = code;
    state.signal = signal;
  });

  let responseTimedOut = false;
  try {
    agent.stdin.end('{"type":"get_commands"}\n');
    const received = await waitUntil(
      () => stdout.includes('"command":"get_commands"'),
      () => state.closed || spawnError !== undefined,
      responseTimeoutMs
    );
    responseTimedOut = !received && !state.closed && spawnError === undefined;
  } finally {
    if (!state.closed && spawnError === undefined) {
      state.sentSigterm = agent.kill('SIGTERM');
      await waitUntil(() => state.closed, () => false, terminateTimeoutMs);
    }
    if (!state.closed && spawnError === undefined) {
      state.sentSigkill = agent.kill('SIGKILL');
      await waitUntil(() => state.closed, () => false, killTimeoutMs);
    }
    if (!state.closed && spawnError !== undefined) {
      await waitUntil(() => state.closed, () => false, killTimeoutMs);
    }
  }

  return {
    response: rpcResponse(stdout),
    responseTimedOut,
    stdout,
    stderr,
    error: spawnError?.message ?? stdinError?.message,
    ...state
  };
}

module.exports = { commandsFromRealPi, isInside };
