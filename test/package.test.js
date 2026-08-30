const assert = require('node:assert/strict');
const { readdirSync, readFileSync, rmSync, statSync } = require('node:fs');
const { mkdtemp } = require('node:fs/promises');
const { tmpdir } = require('node:os');
const { join, resolve } = require('node:path');
const { spawn, spawnSync } = require('node:child_process');
const test = require('node:test');

const root = resolve(__dirname, '..');

test('package exposes a CommonJS typesetter', () => {
  const manifest = require(join(root, 'package.json'));
  const exported = require(root);

  assert.deepEqual({
    moduleType: manifest.type,
    exportedTypesetter: typeof exported.typesetMath
  }, {
    moduleType: 'commonjs',
    exportedTypesetter: 'function'
  });
});

test('a local tarball is discovered by the real Pi runtime', { timeout: 60000 }, async () => {
  const temporary = await mkdtemp(join(tmpdir(), 'pi-formula-package-'));
  try {
    const packed = spawnSync('npm', ['pack', '--json', '--pack-destination', temporary], {
      cwd: root,
      encoding: 'utf8'
    });
    assert.equal(packed.status, 0, packed.stderr);
    const packOutput = JSON.parse(packed.stdout);
    const packResult = Array.isArray(packOutput) ? packOutput[0] : Object.values(packOutput)[0];
    const tarball = join(temporary, packResult.filename);
    const isolatedEnv = {
      ...process.env,
      HOME: temporary,
      XDG_CONFIG_HOME: join(temporary, 'config'),
      PI_CODING_AGENT_DIR: join(temporary, 'agent')
    };
    const installed = spawnSync('pi', [
      'install', `npm:pi-formula@file:${tarball}`
    ], {
      cwd: temporary,
      env: isolatedEnv,
      encoding: 'utf8'
    });
    assert.equal(installed.status, 0, installed.stderr || installed.stdout);
    const agent = spawn('pi', [
      '--mode', 'rpc', '--no-session', '--offline', '--no-context-files',
      '--no-skills', '--no-prompt-templates', '--no-themes'
    ], {
      cwd: temporary,
      env: isolatedEnv,
      stdio: ['pipe', 'pipe', 'pipe']
    });
    let stdout = '';
    let stderr = '';
    agent.stdout.on('data', (chunk) => { stdout += chunk; });
    agent.stderr.on('data', (chunk) => { stderr += chunk; });
    agent.stdin.end('{"type":"get_commands"}\n');
    const exit = new Promise((resolveExit) => agent.on('exit', resolveExit));
    for (let attempt = 0; attempt < 200 && !stdout.includes('"command":"get_commands"'); attempt += 1) {
      await new Promise((resolveWait) => setTimeout(resolveWait, 25));
    }
    agent.kill('SIGTERM');
    await exit;
    const response = stdout.split('\n').filter(Boolean).map((line) => JSON.parse(line))
      .find((event) => event.command === 'get_commands');

    assert.equal(
      response?.data?.commands?.some((command) => command.name === 'formula'),
      true,
      stderr || stdout
    );
  } finally {
    rmSync(temporary, { recursive: true, force: true });
  }
});

test('source contains no qni-specific execution modules', () => {
  const sourceDir = join(root, 'src');
  const pending = [sourceDir];
  const files = [];
  while (pending.length > 0) {
    const directory = pending.pop();
    for (const name of readdirSync(directory)) {
      const path = join(directory, name);
      if (statSync(path).isDirectory()) pending.push(path);
      else files.push(path);
    }
  }
  const source = files.map((file) => readFileSync(file, 'utf8')).join('\n');

  assert.deepEqual({
    hasSource: files.length > 0,
    hasQniSpecificCode: /qni|workdir|registerTool/iu.test(source)
  }, {
    hasSource: true,
    hasQniSpecificCode: false
  });
});
