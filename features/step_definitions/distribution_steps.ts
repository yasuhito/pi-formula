type ProcessResult = import("node:child_process").SpawnSyncReturns<string>;
interface PackageMetadata {
  filename: string;
  files: { path: string }[];
}
interface PackageTrial {
  packed: ProcessResult;
  tarball?: string;
  installed?: ProcessResult;
  packagePath?: string;
  probe?: ProcessResult;
  probeResult?: {
    apiPath: string;
    nativePath?: string;
    pngSignature: string;
    platform: NodeJS.Platform;
    architecture: string;
  };
  pi?: Awaited<ReturnType<typeof commandsFromRealPi>>;
}

interface StepWorld {
  build: ProcessResult;
  galleryImage: string | undefined;
  installedRequire: NodeJS.Require;
  manifest: typeof import("../../package.json");
  packResult: PackageMetadata;
  packageEnvironment: NodeJS.ProcessEnv & { PI_CODING_AGENT_DIR: string };
  packageRelease: string;
  packageTrial: PackageTrial;
  packageTrialRoot: string;
  packageWork: string;
  packedFiles: string[];
  preview: Buffer;
  publicOperations: { registerFormula: string; createFormulaPng: string };
  subpathErrorCode: unknown;
  tarball: string;
}

const assert: typeof import("node:assert/strict") = require("node:assert/strict");
const {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
}: typeof import("node:fs") = require("node:fs");
const { tmpdir }: typeof import("node:os") = require("node:os");
const { join, resolve }: typeof import("node:path") = require("node:path");
const {
  spawnSync,
}: typeof import("node:child_process") = require("node:child_process");
const {
  After,
  Given,
  setDefaultTimeout,
  Then,
  When,
}: typeof import("@cucumber/cucumber") = require("@cucumber/cucumber");
const {
  commandsFromRealPi,
  isInside,
  PACKAGE_TRIAL_STEP_TIMEOUT_MS,
}: typeof import("../../test/support/package-trial") = require("../../test/support/package-trial");
const { createRequire }: typeof import("node:module") = require("node:module");

setDefaultTimeout(30_000);

const root = resolve(__dirname, "../..");
const readProjectFile = (path: string) =>
  readFileSync(join(root, path), "utf8");
const readProjectBinary = (path: string) => readFileSync(join(root, path));

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function packedPackage(packOutput: unknown) {
  const candidate = Array.isArray(packOutput)
    ? packOutput[0]
    : isRecord(packOutput) && typeof packOutput.filename === "string"
      ? packOutput
      : isRecord(packOutput)
        ? packOutput["pi-formula"]
        : undefined;
  if (
    !isRecord(candidate) ||
    typeof candidate.filename !== "string" ||
    candidate.filename.trim() === ""
  ) {
    throw new Error(
      `npm pack did not report a filename: ${JSON.stringify(packOutput)}`,
    );
  }
  return { filename: candidate.filename };
}

After(function (this: StepWorld) {
  if (this.packageTrialRoot) {
    rmSync(this.packageTrialRoot, { recursive: true, force: true });
  }
  rmSync(join(root, "dist/macro-settings.js"), { force: true });
  rmSync(join(root, "dist/macro-settings.d.ts"), { force: true });
});

Given("pi-formula Pi package metadata exists", function (this: StepWorld) {
  this.manifest = JSON.parse(readProjectFile("package.json"));
});

When("inspect image metadata", function (this: StepWorld) {
  this.galleryImage = this.manifest.pi?.image;
  this.preview = readProjectBinary("assets/ghostty-formulas.png");
});

Then(
  "The Pi package image URL points to the Ghostty display sample",
  function (this: StepWorld) {
    assert.deepEqual(
      this.galleryImage,
      "https://raw.githubusercontent.com/yasuhito/pi-formula/main/assets/ghostty-formulas.png",
    );
  },
);

Then("The Ghostty display sample is a PNG", function (this: StepWorld) {
  assert.deepEqual(this.preview.subarray(1, 4).toString("ascii"), "PNG");
});

When("create the pi-formula npm tarball", function (this: StepWorld) {
  const packed = spawnSync("npm", ["pack", "--json"], {
    cwd: root,
    encoding: "utf8",
  });
  if (packed.status !== 0) throw new Error(packed.stderr);
  const output = JSON.parse(packed.stdout);
  this.packResult = Array.isArray(output) ? output[0] : output["pi-formula"];
  this.tarball = join(root, this.packResult.filename);
});

When("inspect the tarball file list", function (this: StepWorld) {
  this.packedFiles = this.packResult.files.map(({ path }) => path).sort();
  rmSync(this.tarball, { force: true });
});

Then(
  "Only src, dist, the English README, LICENSE, CHANGELOG, third-party notices, and the display sample are distributed",
  function (this: StepWorld) {
    const topLevel = [
      ...new Set(this.packedFiles.map((path) => path.split("/")[0])),
    ].sort();
    assert.deepEqual(topLevel, [
      "CHANGELOG.md",
      "LICENSE",
      "README.md",
      "THIRD_PARTY_NOTICES.md",
      "assets",
      "dist",
      "package.json",
      "src",
    ]);
  },
);

Then("The English README is distributed", function (this: StepWorld) {
  assert.equal(this.packedFiles.includes("README.md"), true);
});

Then("The Japanese README is not distributed", function (this: StepWorld) {
  assert.equal(this.packedFiles.includes("README.ja.md"), false);
});

Then("The Ghostty display sample is distributed", function (this: StepWorld) {
  assert.equal(this.packedFiles.includes("assets/ghostty-formulas.png"), true);
});

Given("stale artifacts for deleted sources exist", () => {
  mkdirSync(join(root, "dist"), { recursive: true });
  writeFileSync(join(root, "dist/macro-settings.js"), "module.exports = {};\n");
  writeFileSync(join(root, "dist/macro-settings.d.ts"), "export {};\n");
});

When("build pi-formula", function (this: StepWorld) {
  this.build = spawnSync("npm", ["run", "build"], {
    cwd: root,
    encoding: "utf8",
  });
});

Then(
  "The build succeeds even in a checkout with stale artifacts",
  function (this: StepWorld) {
    assert.deepEqual(this.build.status, 0);
  },
);

Then("The generated dist retains no artifacts for deleted sources", () => {
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

Then(
  "The tarball does not distribute stale artifacts",
  function (this: StepWorld) {
    assert.deepEqual(
      this.packedFiles.filter((path) => path.includes("macro-settings")),
      [],
    );
  },
);

Given(
  "a fresh npm installation directory exists for testing the public API",
  function (this: StepWorld) {
    this.packageTrialRoot = mkdtempSync(join(tmpdir(), "pi-formula-exports-"));
    this.packageRelease = join(this.packageTrialRoot, "release");
    this.packageWork = join(this.packageTrialRoot, "work");
    mkdirSync(this.packageRelease);
    mkdirSync(this.packageWork);
    writeFileSync(join(this.packageWork, "package.json"), '{"private":true}\n');
  },
);

When("load the installed package root", function (this: StepWorld) {
  const api: typeof import("../../dist/api.js") =
    this.installedRequire("pi-formula");
  this.publicOperations = {
    registerFormula: typeof api.registerFormula,
    createFormulaPng: typeof api.createFormulaPng,
  };
});

Then(
  "The installed package extension registration API is callable",
  function (this: StepWorld) {
    assert.deepEqual(this.publicOperations.registerFormula, "function");
  },
);

Then(
  "The installed package PNG creation API is callable",
  function (this: StepWorld) {
    assert.deepEqual(this.publicOperations.createFormulaPng, "function");
  },
);

When(
  "load the installed package internal Markdown subpath",
  function (this: StepWorld) {
    try {
      this.installedRequire("pi-formula/dist/markdown.js");
    } catch (error) {
      this.subpathErrorCode = isRecord(error) ? error.code : undefined;
    }
  },
);

Then("Internal subpaths are not exported", function (this: StepWorld) {
  assert.equal(this.subpathErrorCode, "ERR_PACKAGE_PATH_NOT_EXPORTED");
});

Given(
  "a fresh installation directory and user settings exist for testing real Pi",
  function (this: StepWorld) {
    this.packageTrialRoot = mkdtempSync(
      join(tmpdir(), "pi-formula-candidate-"),
    );
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
  },
);

When(
  "install the release candidate tarball into real Pi",
  {
    timeout: PACKAGE_TRIAL_STEP_TIMEOUT_MS,
  },
  function (this: StepWorld) {
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

Then("The release candidate npm pack succeeds", function (this: StepWorld) {
  const { packed } = this.packageTrial;
  assert.deepEqual(packed.status, 0);
});

Then(
  "Installing the release candidate into Pi succeeds",
  function (this: StepWorld) {
    const { installed } = this.packageTrial;
    assert.deepEqual(installed?.status, 0);
  },
);

Then(
  "The installed distribution Resvg check succeeds",
  function (this: StepWorld) {
    const { probe } = this.packageTrial;
    assert.deepEqual(probe?.status, 0);
  },
);

Then(
  "The public API is loaded from the distribution installed in the temporary environment",
  function (this: StepWorld) {
    const { packagePath, probeResult } = this.packageTrial;
    assert.deepEqual(
      probeResult?.apiPath && packagePath
        ? isInside(packagePath, probeResult.apiPath)
        : false,
      true,
    );
  },
);

Then(
  "The native Resvg component is loaded from the distribution installed in the temporary environment",
  function (this: StepWorld) {
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

Then(
  "The installed native Resvg component supports the current OS and CPU",
  function (this: StepWorld) {
    const { probeResult } = this.packageTrial;
    assert.deepEqual(
      probeResult?.nativePath
        ? probeResult.nativePath.includes(
            `resvg-js-${probeResult.platform}-${probeResult.architecture}`,
          )
        : false,
      true,
    );
  },
);

Then("The installed Resvg can create PNG data", function (this: StepWorld) {
  const { probeResult } = this.packageTrial;
  assert.deepEqual(probeResult?.pngSignature, "PNG");
});

Then(
  "Real Pi exits after inspecting the distribution",
  function (this: StepWorld) {
    const { pi } = this.packageTrial;
    assert.deepEqual(pi?.closed, true);
  },
);

Then(
  "The real Pi command list response does not time out",
  function (this: StepWorld) {
    const { pi } = this.packageTrial;
    assert.deepEqual(pi?.responseTimedOut, false);
  },
);

Then(
  "Real Pi discovers the installed formula command",
  function (this: StepWorld) {
    const { pi } = this.packageTrial;
    const data = pi?.response?.data;
    assert.deepEqual(
      isRecord(data) &&
        Array.isArray(data.commands) &&
        data.commands.some(
          (command: unknown) => isRecord(command) && command.name === "formula",
        ),
      true,
    );
  },
);

When("create the public API test tarball", function (this: StepWorld) {
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

When(
  "install the public API test tarball with npm",
  function (this: StepWorld) {
    const installed = spawnSync(
      "npm",
      ["install", "--ignore-scripts", "--no-audit", "--no-fund", this.tarball],
      { cwd: this.packageWork, encoding: "utf8" },
    );
    if (installed.error || installed.status !== 0)
      throw new Error(
        installed.error?.message ?? (installed.stderr || installed.stdout),
      );
    this.installedRequire = createRequire(
      join(this.packageWork, "package.json"),
    );
  },
);

When("create the release candidate tarball", function (this: StepWorld) {
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
  "inspect the origins of Resvg and the public API in the installed distribution",
  function (this: StepWorld) {
    if (this.packageTrial.installed?.status !== 0) return;
    const agentDirectory = this.packageEnvironment.PI_CODING_AGENT_DIR;
    const work = this.packageWork;
    const env = this.packageEnvironment;
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
  },
);

When(
  "query the real Pi command list in the installation directory",
  async function (this: StepWorld) {
    if (this.packageTrial.installed?.status !== 0) return;
    this.packageTrial.pi = await commandsFromRealPi(
      this.packageWork,
      this.packageEnvironment,
    );
  },
);
