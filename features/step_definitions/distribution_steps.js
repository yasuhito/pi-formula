const assert = require("node:assert/strict");
const {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} = require("node:fs");
const { tmpdir } = require("node:os");
const { join, resolve } = require("node:path");
const { spawnSync } = require("node:child_process");
const { createHash } = require("node:crypto");
const {
  After,
  Given,
  setDefaultTimeout,
  Then,
  When,
} = require("@cucumber/cucumber");
const {
  commandsFromRealPi,
  isInside,
  PACKAGE_TRIAL_STEP_TIMEOUT_MS,
} = require("../../test/support/package-trial");
const { createRequire } = require("node:module");

setDefaultTimeout(30_000);

const root = resolve(__dirname, "../..");
const readProjectFile = (path) => readFileSync(join(root, path), "utf8");
const readProjectBinary = (path) => readFileSync(join(root, path));

function packedPackage(packOutput) {
  const candidate = Array.isArray(packOutput)
    ? packOutput[0]
    : typeof packOutput?.filename === "string"
      ? packOutput
      : packOutput?.["pi-formula"];
  if (
    typeof candidate?.filename !== "string" ||
    candidate.filename.trim() === ""
  ) {
    throw new Error(
      `npm pack did not report a filename: ${JSON.stringify(packOutput)}`,
    );
  }
  return candidate;
}

After(function () {
  if (this.packageTrialRoot) {
    rmSync(this.packageTrialRoot, { recursive: true, force: true });
  }
  rmSync(join(root, "dist/macro-settings.js"), { force: true });
  rmSync(join(root, "dist/macro-settings.d.ts"), { force: true });
});

Given("pi-formula の英語と日本語の README がある", function () {
  this.englishReadme = readProjectFile("README.md");
  this.japaneseReadme = readProjectFile("README.ja.md");
});

When("利用者向けの導入、設定、対応範囲を調べる", function () {
  this.readmes = {
    english: this.englishReadme,
    japanese: this.japaneseReadme,
  };
});

Then("{word} のREADMEに {word} の案内がある", function (language, topic) {
  const common = {
    primaryInstall: /pi install npm:pi-formula(?!@)/u,
    preview: /assets\/ghostty-formulas\.png/u,
    command: /\/formula/u,
    environmentConfig: /PI_FORMULA_MACROS/u,
    configFile: /config\.json/u,
    ghostty: /Ghostty/u,
    kitty: /Kitty/u,
    linux: /Linux/u,
    macOS: /macOS/u,
  };
  const localized = {
    english: {
      unsupported: /not supported/iu,
      coexistence: /other math (?:rendering )?extensions/iu,
      languageLink: /README\.ja\.md/u,
    },
    japanese: {
      unsupported: /未対応/u,
      coexistence: /他の数式拡張/u,
      languageLink: /README\.md/u,
    },
  };
  if (!Object.hasOwn(localized, language))
    throw new Error(`unknown README language: ${language}`);
  const pattern = { ...common, ...localized[language] }[topic];
  if (!pattern) throw new Error(`unknown README topic: ${topic}`);
  assert.equal(pattern.test(this.readmes[language]), true);
});

Given("pi-formula の Pi パッケージ情報がある", function () {
  this.manifest = JSON.parse(readProjectFile("package.json"));
});

When("画像情報を調べる", function () {
  this.galleryImage = this.manifest.pi?.image;
  this.preview = readProjectBinary("assets/ghostty-formulas.png");
});

Then("Piパッケージの画像URLはGhostty表示見本を指す", function () {
  assert.deepEqual(
    this.galleryImage,
    "https://raw.githubusercontent.com/yasuhito/pi-formula/main/assets/ghostty-formulas.png",
  );
});

Then("Ghostty表示見本はPNG形式である", function () {
  assert.deepEqual(this.preview.subarray(1, 4).toString("ascii"), "PNG");
});

Then("Ghostty表示見本の幅は775pxである", function () {
  assert.deepEqual(this.preview.readUInt32BE(16), 775);
});

Then("Ghostty表示見本の高さは830pxである", function () {
  assert.deepEqual(this.preview.readUInt32BE(20), 830);
});

Then("Ghostty表示見本は目視承認済みの画像と一致する", function () {
  assert.deepEqual(
    createHash("sha256").update(this.preview).digest("hex"),
    "e2366c3079f342604783945c98f9e3994b011d08806984ee7a8338d67baf47a1",
  );
});

When("pi-formula の npm tarball を作る", function () {
  const packed = spawnSync("npm", ["pack", "--json"], {
    cwd: root,
    encoding: "utf8",
  });
  if (packed.status !== 0) throw new Error(packed.stderr);
  const output = JSON.parse(packed.stdout);
  this.packResult = Array.isArray(output) ? output[0] : output["pi-formula"];
  this.tarball = join(root, this.packResult.filename);
});

When("tarball のファイル一覧を調べる", function () {
  this.packedFiles = this.packResult.files.map(({ path }) => path).sort();
  rmSync(this.tarball, { force: true });
});

Then(
  "src、dist、両言語の README、LICENSE、CHANGELOG、第三者部品情報、表示見本だけが配布される",
  function () {
    const topLevel = [
      ...new Set(this.packedFiles.map((path) => path.split("/")[0])),
    ].sort();
    assert.deepEqual(topLevel, [
      "CHANGELOG.md",
      "LICENSE",
      "README.ja.md",
      "README.md",
      "THIRD_PARTY_NOTICES.md",
      "assets",
      "dist",
      "package.json",
      "src",
    ]);
  },
);

Then("Ghostty の表示見本が配布される", function () {
  assert.equal(this.packedFiles.includes("assets/ghostty-formulas.png"), true);
});

Given("削除済みソースに対応する古い成果物がある", () => {
  mkdirSync(join(root, "dist"), { recursive: true });
  writeFileSync(join(root, "dist/macro-settings.js"), "module.exports = {};\n");
  writeFileSync(join(root, "dist/macro-settings.d.ts"), "export {};\n");
});

When("pi-formula を build する", function () {
  this.build = spawnSync("npm", ["run", "build"], {
    cwd: root,
    encoding: "utf8",
  });
});

Then("古い成果物があるcheckoutでもbuildは正常終了する", function () {
  assert.deepEqual(this.build.status, 0);
});

Then("生成後のdistには削除済みソースの成果物が残らない", () => {
  const staleFiles = [
    "dist/macro-settings.js",
    "dist/macro-settings.d.ts",
  ].filter((path) => {
    try {
      readProjectFile(path);
      return true;
    } catch {
      return false;
    }
  });
  assert.deepEqual(staleFiles, []);
});

Then("tarball に古い成果物が配布されない", function () {
  assert.deepEqual(
    this.packedFiles.filter((path) => path.includes("macro-settings")),
    [],
  );
});

Given("公開APIを試す新しいnpm導入先がある", function () {
  this.packageTrialRoot = mkdtempSync(join(tmpdir(), "pi-formula-exports-"));
  this.packageRelease = join(this.packageTrialRoot, "release");
  this.packageWork = join(this.packageTrialRoot, "work");
  mkdirSync(this.packageRelease);
  mkdirSync(this.packageWork);
  writeFileSync(join(this.packageWork, "package.json"), '{"private":true}\n');
});

When("導入したパッケージのルートを読み込む", function () {
  const api = this.installedRequire("pi-formula");
  this.publicOperations = {
    registerFormula: typeof api.registerFormula,
    createFormulaPng: typeof api.createFormulaPng,
  };
});

Then("導入したパッケージの拡張登録APIを呼び出せる", function () {
  assert.deepEqual(this.publicOperations.registerFormula, "function");
});

Then("導入したパッケージのPNG作成APIを呼び出せる", function () {
  assert.deepEqual(this.publicOperations.createFormulaPng, "function");
});

When("導入したパッケージの内部 Markdown subpath を読み込む", function () {
  try {
    this.installedRequire("pi-formula/dist/markdown.js");
  } catch (error) {
    this.subpathErrorCode = error.code;
  }
});

Then("内部 subpath は公開されていない", function () {
  assert.equal(this.subpathErrorCode, "ERR_PACKAGE_PATH_NOT_EXPORTED");
});

Given("本物のPiを試す新しい導入先と利用者設定がある", function () {
  this.packageTrialRoot = mkdtempSync(join(tmpdir(), "pi-formula-candidate-"));
  this.packageWork = join(this.packageTrialRoot, "work");
  const home = join(this.packageTrialRoot, "home");
  const config = join(this.packageTrialRoot, "config");
  const agentDirectory = join(this.packageTrialRoot, "agent");
  for (const directory of [this.packageWork, home, config, agentDirectory])
    mkdirSync(directory, { recursive: true });
  this.packageEnvironment = {
    ...process.env,
    HOME: home,
    XDG_CONFIG_HOME: config,
    PI_CODING_AGENT_DIR: agentDirectory,
  };
});

When(
  "公開候補のtarballを本物のPiへ導入する",
  {
    timeout: PACKAGE_TRIAL_STEP_TIMEOUT_MS,
  },
  function () {
    if (!this.packageTrial.tarball) return;
    this.packageTrial.installed = spawnSync(
      "pi",
      ["install", `npm:pi-formula@file:${this.packageTrial.tarball}`],
      {
        cwd: this.packageWork,
        env: this.packageEnvironment,
        encoding: "utf8",
      },
    );
  },
);

Then("公開候補のnpm packは正常終了する", function () {
  const { packed } = this.packageTrial;
  assert.deepEqual(packed.status, 0);
});

Then("公開候補のPiへの導入は正常終了する", function () {
  const { installed } = this.packageTrial;
  assert.deepEqual(installed?.status, 0);
});

Then("導入した配布物のResvg検査は正常終了する", function () {
  const { probe } = this.packageTrial;
  assert.deepEqual(probe?.status, 0);
});

Then("公開APIは一時環境へ導入した配布物から読み込まれる", function () {
  const { packagePath, probeResult } = this.packageTrial;
  assert.deepEqual(
    probeResult?.apiPath ? isInside(packagePath, probeResult.apiPath) : false,
    true,
  );
});

Then(
  "Resvgのnative部品は一時環境へ導入した配布物から読み込まれる",
  function () {
    const { probeResult } = this.packageTrial;
    const nodeModules = join(
      this.packageTrialRoot,
      "agent",
      "npm",
      "node_modules",
    );
    assert.deepEqual(
      probeResult?.nativePath
        ? isInside(nodeModules, probeResult.nativePath)
        : false,
      true,
    );
  },
);

Then("導入したResvgのnative部品は現在のOSとCPUに対応する", function () {
  const { probeResult } = this.packageTrial;
  assert.deepEqual(
    probeResult?.nativePath
      ? probeResult.nativePath.includes(
          `resvg-js-${probeResult.platform}-${probeResult.architecture}`,
        )
      : false,
    true,
  );
});

Then("導入したResvgでPNGデータを作れる", function () {
  const { probeResult } = this.packageTrial;
  assert.deepEqual(probeResult?.pngSignature, "PNG");
});

Then("配布物を調べた本物のPiは終了する", function () {
  const { pi } = this.packageTrial;
  assert.deepEqual(pi?.closed, true);
});

Then("本物のPiのコマンド一覧の応答は時間切れにならない", function () {
  const { pi } = this.packageTrial;
  assert.deepEqual(pi?.responseTimedOut, false);
});

Then("本物のPiが導入したformulaコマンドを発見する", function () {
  const { pi } = this.packageTrial;
  assert.deepEqual(
    pi?.response?.data?.commands?.some(({ name }) => name === "formula") ??
      false,
    true,
  );
});

Given("pi-formula のライセンスと第三者部品情報がある", function () {
  this.license = readProjectFile("LICENSE");
  this.notices = readProjectFile("THIRD_PARTY_NOTICES.md");
  this.manifest = JSON.parse(readProjectFile("package.json"));
});

When("由来、版、更新状況、ライセンス、既知の脆弱性を調べる", function () {
  this.directDependencies = {
    ...this.manifest.dependencies,
    ...this.manifest.peerDependencies,
  };
  this.auditRows = new Map(
    this.notices
      .split("\n")
      .filter((line) => line.startsWith("| [`@"))
      .map((line) => {
        const cells = line
          .split("|")
          .slice(1, -1)
          .map((cell) => cell.trim());
        const name = /`([^`]+)`/u.exec(cells[0])?.[1];
        return [name, cells];
      }),
  );
});

Then("パッケージのライセンスはMITである", function () {
  assert.deepEqual(this.license.startsWith("MIT License"), true);
});

Then("第三者部品情報にqni-cliの取り込み元commitが示される", function () {
  assert.deepEqual(
    this.notices.includes("yasuhito/qni-cli") &&
      this.notices.includes("2f12594e80b9e7baff0c85ecfecb4dd34d06f737"),
    true,
  );
});

Then("依存監査の確認日は2026年8月31日である", function () {
  assert.deepEqual(/2026-08-31/u.test(this.notices), true);
});

Then("監査対象の直接依存がpackage情報と一致する", function () {
  assert.deepEqual(
    Object.keys(this.directDependencies).sort(),
    [
      "@mathjax/src",
      "@resvg/resvg-js",
      "@earendil-works/pi-coding-agent",
      "@earendil-works/pi-tui",
    ].sort(),
  );
});

Then("すべての直接依存が監査表に含まれる", function () {
  assert.deepEqual(
    [...this.auditRows.keys()].sort(),
    [
      "@mathjax/src",
      "@resvg/resvg-js",
      "@earendil-works/pi-coding-agent",
      "@earendil-works/pi-tui",
    ].sort(),
  );
});

Then("直接依存の監査記録は次のとおりである", function (table) {
  const expectedRows = Object.fromEntries(
    table
      .raw()
      .slice(1)
      .map(([name, ...values]) => [name, values]),
  );
  const auditedRows = Object.fromEntries(
    Object.keys(expectedRows).map((name) => [
      name,
      this.auditRows.get(name)?.slice(1),
    ]),
  );
  assert.deepEqual(auditedRows, expectedRows);
});

When("公開API試験用のtarballを作る", function () {
  const packed = spawnSync(
    "npm",
    ["pack", "--json", "--pack-destination", this.packageRelease],
    { cwd: root, encoding: "utf8" },
  );
  if (packed.error || packed.status !== 0)
    throw new Error(packed.error?.message ?? packed.stderr);
  this.tarball = join(
    this.packageRelease,
    packedPackage(JSON.parse(packed.stdout)).filename,
  );
});

When("公開API試験用のtarballをnpmで導入する", function () {
  const installed = spawnSync(
    "npm",
    ["install", "--ignore-scripts", "--no-audit", "--no-fund", this.tarball],
    { cwd: this.packageWork, encoding: "utf8" },
  );
  if (installed.error || installed.status !== 0)
    throw new Error(
      installed.error?.message ?? (installed.stderr || installed.stdout),
    );
  this.installedRequire = createRequire(join(this.packageWork, "package.json"));
});

When("公開候補のtarballを作る", function () {
  const release = join(this.packageTrialRoot, "release");
  mkdirSync(release);
  const packed = spawnSync(
    "npm",
    ["pack", "--json", "--pack-destination", release],
    {
      cwd: root,
      encoding: "utf8",
    },
  );
  this.packageTrial = { packed };
  if (packed.status === 0) {
    const candidate = packedPackage(JSON.parse(packed.stdout));
    this.packageTrial.tarball = join(release, candidate.filename);
  }
});

When("導入した配布物のResvgと公開APIの由来を調べる", function () {
  if (this.packageTrial.installed?.status !== 0) return;
  const agentDirectory = this.packageEnvironment.PI_CODING_AGENT_DIR;
  const work = this.packageWork;
  const env = this.packageEnvironment;
  const packagePath = join(agentDirectory, "npm", "node_modules", "pi-formula");
  const probeScript = `
    const { createRequire } = require('node:module');
    const { join } = require('node:path');
    const packagePath = process.env.PI_FORMULA_PACKAGE_PATH;
    const installedRequire = createRequire(join(packagePath, 'package.json'));
    const { Resvg } = installedRequire('@resvg/resvg-js');
    const png = Buffer.from(new Resvg(
      '<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1">' +
      '<rect width="1" height="1"/></svg>'
    ).render().asPng());
    const nativePath = Object.keys(require.cache).find((path) => path.endsWith('.node'));
    process.stdout.write(JSON.stringify({
      apiPath: installedRequire.resolve(packagePath),
      nativePath,
      pngSignature: png.subarray(1, 4).toString('ascii'),
      platform: process.platform,
      architecture: process.arch
    }));
  `;
  const probe = spawnSync(process.execPath, ["--eval", probeScript], {
    cwd: work,
    env: { ...env, PI_FORMULA_PACKAGE_PATH: packagePath },
    encoding: "utf8",
  });
  this.packageTrial.packagePath = packagePath;
  this.packageTrial.probe = probe;
  if (probe.status === 0)
    this.packageTrial.probeResult = JSON.parse(probe.stdout);
});

When("導入先で本物のPiのコマンド一覧を問い合わせる", async function () {
  if (this.packageTrial.installed?.status !== 0) return;
  this.packageTrial.pi = await commandsFromRealPi(
    this.packageWork,
    this.packageEnvironment,
  );
});
