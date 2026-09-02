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
const { installPackedPackage } = require("../../test/support/packed-install");

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

Then(
  "両言語から導入方法、表示見本、formula コマンド、設定、対応端末、対応 OS、未対応範囲、他の数式拡張との併用注意が分かる",
  function () {
    const sharedChecks = (readme) => ({
      primaryInstall: /pi install npm:pi-formula(?!@)/u.test(readme),
      preview: /assets\/ghostty-formulas\.png/u.test(readme),
      command: /\/formula/u.test(readme),
      config: /PI_FORMULA_MACROS/u.test(readme) && /config\.json/u.test(readme),
      terminals: /Ghostty/u.test(readme) && /Kitty/u.test(readme),
      operatingSystems: /Linux/u.test(readme) && /macOS/u.test(readme),
    });
    const checks = {
      reciprocalLinks:
        /README\.ja\.md/u.test(this.englishReadme) &&
        /README\.md/u.test(this.japaneseReadme),
      english: {
        ...sharedChecks(this.readmes.english),
        unsupported: /not supported/iu.test(this.readmes.english),
        coexistence: /other math (?:rendering )?extensions/iu.test(
          this.readmes.english,
        ),
      },
      japanese: {
        ...sharedChecks(this.readmes.japanese),
        unsupported: /未対応/u.test(this.readmes.japanese),
        coexistence: /他の数式拡張/u.test(this.readmes.japanese),
      },
    };
    assert.equal(
      checks.reciprocalLinks &&
        Object.values(checks.english).every(Boolean) &&
        Object.values(checks.japanese).every(Boolean),
      true,
      JSON.stringify(checks),
    );
  },
);

Given("pi-formula の Pi パッケージ情報がある", function () {
  this.manifest = JSON.parse(readProjectFile("package.json"));
});

When("画像情報を調べる", function () {
  this.galleryImage = this.manifest.pi?.image;
  this.preview = readProjectBinary("assets/ghostty-formulas.png");
});

Then(
  "Unicode のインライン数式と画像の表示数式を含む Ghostty 表示見本が設定されている",
  function () {
    // Update these fixed values only after visually approving a replacement Ghostty preview.
    assert.deepEqual(
      {
        galleryImage: this.galleryImage,
        pngSignature: this.preview.subarray(1, 4).toString("ascii"),
        width: this.preview.readUInt32BE(16),
        height: this.preview.readUInt32BE(20),
        sha256: createHash("sha256").update(this.preview).digest("hex"),
      },
      {
        galleryImage:
          "https://raw.githubusercontent.com/yasuhito/pi-formula/main/assets/ghostty-formulas.png",
        pngSignature: "PNG",
        width: 775,
        height: 830,
        sha256:
          "e2366c3079f342604783945c98f9e3994b011d08806984ee7a8338d67baf47a1",
      },
    );
  },
);

Given("pi-formula の npm tarball を作る", function () {
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

Then("生成後の dist に古い成果物が残らない", function () {
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
  assert.deepEqual(
    { buildStatus: this.build.status, staleFiles },
    { buildStatus: 0, staleFiles: [] },
    this.build.stderr || this.build.stdout,
  );
});

Then("tarball に古い成果物が配布されない", function () {
  assert.deepEqual(
    this.packedFiles.filter((path) => path.includes("macro-settings")),
    [],
  );
});

Given("pi-formula の npm tarball を一時環境へ導入する", function () {
  this.packageTrialRoot = mkdtempSync(join(tmpdir(), "pi-formula-exports-"));
  this.installedRequire = installPackedPackage(root, this.packageTrialRoot);
});

When("導入したパッケージのルートを読み込む", function () {
  const api = this.installedRequire("pi-formula");
  this.publicOperations = {
    registerFormula: typeof api.registerFormula,
    createFormulaPng: typeof api.createFormulaPng,
  };
});

Then("拡張登録と同期的な PNG 作成が使える", function () {
  assert.deepEqual(this.publicOperations, {
    registerFormula: "function",
    createFormulaPng: "function",
  });
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

Given("pi-formula の公開候補 tarball がある", function () {
  this.packageTrialRoot = mkdtempSync(join(tmpdir(), "pi-formula-candidate-"));
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

When(
  "tarball を新しい一時環境へ導入して本物の Pi で調べる",
  {
    timeout: PACKAGE_TRIAL_STEP_TIMEOUT_MS,
  },
  async function () {
    const work = join(this.packageTrialRoot, "work");
    const home = join(this.packageTrialRoot, "home");
    const config = join(this.packageTrialRoot, "config");
    const agentDirectory = join(this.packageTrialRoot, "agent");
    for (const directory of [work, home, config, agentDirectory]) {
      mkdirSync(directory, { recursive: true });
    }
    const env = {
      ...process.env,
      HOME: home,
      XDG_CONFIG_HOME: config,
      PI_CODING_AGENT_DIR: agentDirectory,
    };
    if (!this.packageTrial.tarball) return;
    const installed = spawnSync(
      "pi",
      ["install", `npm:pi-formula@file:${this.packageTrial.tarball}`],
      {
        cwd: work,
        env,
        encoding: "utf8",
      },
    );
    this.packageTrial.installed = installed;
    if (installed.status !== 0) return;

    const packagePath = join(
      agentDirectory,
      "npm",
      "node_modules",
      "pi-formula",
    );
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
    this.packageTrial.pi = await commandsFromRealPi(work, env);
  },
);

Then(
  "導入した配布物だけから OS 用 Resvg が読み込まれ formula コマンドが発見される",
  function () {
    const { packed, installed, packagePath, pi, probe, probeResult } =
      this.packageTrial;
    const nodeModules = join(
      this.packageTrialRoot,
      "agent",
      "npm",
      "node_modules",
    );
    const actual = {
      packStatus: packed.status,
      installStatus: installed?.status,
      probeStatus: probe?.status,
      apiFromTemporaryInstall: probeResult?.apiPath
        ? isInside(packagePath, probeResult.apiPath)
        : false,
      nativeResvgFromTemporaryInstall: probeResult?.nativePath
        ? isInside(nodeModules, probeResult.nativePath)
        : false,
      nativeResvgMatchesOs: probeResult?.nativePath
        ? probeResult.nativePath.includes(
            `resvg-js-${probeResult.platform}-${probeResult.architecture}`,
          )
        : false,
      pngSignature: probeResult?.pngSignature,
      piClosed: pi?.closed,
      piResponseTimedOut: pi?.responseTimedOut,
      formulaDiscovered:
        pi?.response?.data?.commands?.some(({ name }) => name === "formula") ??
        false,
    };
    assert.deepEqual(
      actual,
      {
        packStatus: 0,
        installStatus: 0,
        probeStatus: 0,
        apiFromTemporaryInstall: true,
        nativeResvgFromTemporaryInstall: true,
        nativeResvgMatchesOs: true,
        pngSignature: "PNG",
        piClosed: true,
        piResponseTimedOut: false,
        formulaDiscovered: true,
      },
      JSON.stringify({
        actual,
        packError: packed.stderr,
        installError: installed?.stderr || installed?.stdout,
        probeError: probe?.stderr || probe?.stdout,
        piError: pi?.error || pi?.stderr || pi?.stdout,
        piLifecycle: pi && {
          closed: pi.closed,
          code: pi.code,
          signal: pi.signal,
          responseTimedOut: pi.responseTimedOut,
          sentSigterm: pi.sentSigterm,
          sentSigkill: pi.sentSigkill,
        },
      }),
    );
  },
);

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

Then(
  "MIT License、取り込み元、すべての直接依存の監査結果と確認日が分かる",
  function () {
    const expectedRows = {
      "@mathjax/src": [
        "`^4.1.3` (lockfile: `4.1.3`)",
        "`4.1.3`",
        "2026-07-03",
        "Current",
        "Apache-2.0",
        "None (`npm audit`)",
      ],
      "@resvg/resvg-js": [
        "`^2.6.2` (lockfile: `2.6.2`)",
        "`2.6.2`",
        "2024-03-26",
        "Current stable; next `2.7.0-alpha.2` (2026-01-28)",
        "MPL-2.0",
        "None (`npm audit`)",
      ],
      "@earendil-works/pi-coding-agent": [
        "`*` (verified: `0.84.4`)",
        "`0.84.4`",
        "2026-08-28",
        "Current",
        "MIT",
        "None (`npm audit`)",
      ],
      "@earendil-works/pi-tui": [
        "`*` (verified: `0.84.4`)",
        "`0.84.4`",
        "2026-08-28",
        "Current",
        "MIT",
        "None (`npm audit`)",
      ],
    };
    const auditedRows = Object.fromEntries(
      Object.keys(expectedRows).map((name) => [
        name,
        this.auditRows.get(name)?.slice(1),
      ]),
    );
    assert.deepEqual(
      {
        mitLicense: this.license.startsWith("MIT License"),
        provenance:
          this.notices.includes("yasuhito/qni-cli") &&
          this.notices.includes("2f12594e80b9e7baff0c85ecfecb4dd34d06f737"),
        auditDate: /2026-08-31/u.test(this.notices),
        directDependencyNames: Object.keys(this.directDependencies).sort(),
        auditedNames: [...this.auditRows.keys()].sort(),
        auditedRows,
      },
      {
        mitLicense: true,
        provenance: true,
        auditDate: true,
        directDependencyNames: Object.keys(expectedRows).sort(),
        auditedNames: Object.keys(expectedRows).sort(),
        auditedRows: expectedRows,
      },
    );
  },
);
