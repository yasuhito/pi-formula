const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { Given, Then, When } = require('@cucumber/cucumber');

const { createPng } = require('../../test/support/png-fixture');
const root = path.resolve(__dirname, '../..');

function normalDisplay(x, y) {
  if (y >= 35 && y <= 45 && x >= 25 && x < 95 && (x + y) % 11 < 2) return [40, 40, 35];
  return [250, 248, 240];
}

Given('実表示検証ハーネスと Issue 21 の再現コーパスがある', function () {
  this.harness = fs.readFileSync(path.join(root, 'scripts/verify-display'), 'utf8');
  this.corpus = fs.readFileSync(path.join(root, 'docs/agents/verify-corpus/issue-21.md'), 'utf8');
});

When('ハーネスの安全条件を調べる', function () {
  this.safety = {
    headless: /output create headless/u.test(this.harness),
    tallOutput: /16000/u.test(this.harness) && /grim -o/u.test(this.harness),
    launchRule: /workspace = .* silent/u.test(this.harness)
      && /monitor = .* silent/u.test(this.harness)
      && /no_initial_focus = true/u.test(this.harness),
    timeouts: /run\(\).*timeout/su.test(this.harness)
      && /PI_FORMULA_VERIFY_WINDOW_LIFETIME/u.test(this.harness),
    focusGuard: /AFTER_FOCUS.*BEFORE_FOCUS/su.test(this.harness),
    cleanup: /trap cleanup EXIT INT TERM HUP/u.test(this.harness)
      && /output remove/u.test(this.harness)
      && /window\.close/u.test(this.harness)
  };
});

Then('headless 出力への起動、全履歴キャプチャ、全外部処理の時間上限、フォーカス不変確認、終了時の後片付けが揃っている', function () {
  assert.ok(this.corpus.includes('F_8'));
  assert.deepEqual(this.safety, {
    headless: true,
    tallOutput: true,
    launchRule: true,
    timeouts: true,
    focusGuard: true,
    cleanup: true
  });
});

function givenPng(world, withBand) {
  world.directory = fs.mkdtempSync(path.join(os.tmpdir(), 'pi-formula-cucumber-band-'));
  world.capture = path.join(world.directory, 'capture.png');
  fs.writeFileSync(world.capture, createPng(120, 80, (x, y) => {
    if (withBand && y >= 36 && y <= 43 && x >= 18 && x <= 105) return [210, 0, 170];
    return normalDisplay(x, y);
  }));
}

Given('帯のない表示数式の合成 PNG がある', function () {
  givenPng(this, false);
});

Given('ID 色の水平帯がある表示数式の合成 PNG がある', function () {
  givenPng(this, true);
});

When('ピクセル判定を実行する', function () {
  this.result = spawnSync(process.execPath, [
    path.join(root, 'scripts/detect-display-bands.js'), this.capture
  ], { encoding: 'utf8', timeout: 5_000 });
  fs.rmSync(this.directory, { recursive: true, force: true });
});

Then('表示数式のキャプチャは正常と判定される', function () {
  assert.equal(this.result.status, 0, this.result.stderr);
  assert.match(this.result.stdout, /異常な水平帯はありません/u);
});

Then('水平帯の座標が報告される', function () {
  assert.equal(this.result.status, 1);
  assert.match(this.result.stdout, /x=18\.\.105, y=36\.\.43/u);
});
