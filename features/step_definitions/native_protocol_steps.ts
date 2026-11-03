interface StepWorld {
  buildPlan: Record<string, string>;
  encoderEnvironment: NodeJS.ProcessEnv;
  entranceArguments: string[];
  nativeCommand: string[];
  nativeEnvironment: NodeJS.ProcessEnv;
  nativeResult: import("node:child_process").SpawnSyncReturns<string>;
  nativeTestDirectory: string;
  vtTool: string;
}

const assert: typeof import("node:assert/strict") = require("node:assert/strict");
const fs: typeof import("node:fs") = require("node:fs");
const os: typeof import("node:os") = require("node:os");
const path: typeof import("node:path") = require("node:path");
const {
  spawnSync,
}: typeof import("node:child_process") = require("node:child_process");
const {
  After,
  Before,
  Given,
  Then,
  When,
}: typeof import("@cucumber/cucumber") = require("@cucumber/cucumber");
const {
  resolveVtTool,
}: typeof import("../../scripts/vt-tool") = require("../../scripts/vt-tool");

const root = path.resolve(__dirname, "../..");

Before({ tags: "@native-vt" }, function (this: StepWorld) {
  const tool = resolveVtTool();
  if (tool) {
    this.vtTool = tool;
    return undefined;
  }
  console.log("SKIP: libghostty-vt protocol check (vt-pty is unavailable)");
  return "skipped";
});

After(function (this: StepWorld) {
  if (this.nativeTestDirectory) {
    fs.rmSync(this.nativeTestDirectory, { recursive: true, force: true });
  }
});

Given("an environment without vt-pty exists", function (this: StepWorld) {
  this.nativeTestDirectory = fs.mkdtempSync(
    path.join(os.tmpdir(), "pi-formula-native-test-"),
  );
  this.nativeEnvironment = {
    ...process.env,
    PI_FORMULA_VT_TOOL: path.join(this.nativeTestDirectory, "missing-vt-pty"),
    XDG_CACHE_HOME: this.nativeTestDirectory,
  };
  this.entranceArguments = ["--", "printf", "hello"];
});

Given(
  "vt-pty is specified by an environment variable",
  function (this: StepWorld) {
    this.nativeTestDirectory = fs.mkdtempSync(
      path.join(os.tmpdir(), "pi-formula-native-test-"),
    );
    const selectedTool = path.join(this.nativeTestDirectory, "selected-vt-pty");
    fs.writeFileSync(selectedTool, "#!/bin/sh\nprintf 'selected vt-pty\\n'\n");
    fs.chmodSync(selectedTool, 0o755);
    this.nativeEnvironment = {
      ...process.env,
      PI_FORMULA_VT_TOOL: selectedTool,
    };
    this.entranceArguments = ["--", "printf", "hello"];
  },
);

Given(
  "a native prefix setting exists in the home directory",
  function (this: StepWorld) {
    fs.mkdirSync(path.join(os.homedir(), ".cache"), { recursive: true });
    this.nativeTestDirectory = fs.mkdtempSync(
      path.join(os.homedir(), ".cache/pi-formula-native-plan-"),
    );
  },
);

Given("a test checkout has no build artifacts", function (this: StepWorld) {
  this.nativeTestDirectory = fs.mkdtempSync(
    path.join(os.tmpdir(), "pi-formula-encoder-checkout-"),
  );
  for (const file of ["package.json", "tsconfig.json"]) {
    fs.copyFileSync(
      path.join(root, file),
      path.join(this.nativeTestDirectory, file),
    );
  }
  for (const directory of ["src", "test/support"]) {
    fs.cpSync(
      path.join(root, directory),
      path.join(this.nativeTestDirectory, directory),
      { recursive: true },
    );
  }
  fs.mkdirSync(path.join(this.nativeTestDirectory, "scripts"));
  for (const file of [
    "clean-dist.js",
    "verify-encoder-protocol.js",
    "vt-tool.js",
  ]) {
    fs.copyFileSync(
      path.join(root, "scripts", file),
      path.join(this.nativeTestDirectory, "scripts", file),
    );
  }
  fs.mkdirSync(path.join(this.nativeTestDirectory, "native"));
  fs.copyFileSync(
    path.join(root, "native/libghostty-vt.commit"),
    path.join(this.nativeTestDirectory, "native/libghostty-vt.commit"),
  );
  fs.symlinkSync(
    path.join(root, "node_modules"),
    path.join(this.nativeTestDirectory, "node_modules"),
    "dir",
  );
});

Given(
  "user settings select the text path in a tmux terminal environment",
  function (this: StepWorld) {
    const configHome = path.join(this.nativeTestDirectory, "user-config");
    const formulaConfig = path.join(configHome, "pi-formula");
    fs.mkdirSync(formulaConfig, { recursive: true });
    fs.writeFileSync(
      path.join(formulaConfig, "config.json"),
      JSON.stringify({
        path: "text",
        macros: { usermacro: String.raw`\beta` },
      }),
    );
    this.encoderEnvironment = {
      ...process.env,
      PI_FORMULA_VT_TOOL: this.vtTool,
      PI_FORMULA_MACROS: JSON.stringify({
        environmentmacro: String.raw`\gamma`,
      }),
      TERM: "tmux-256color",
      TMUX: "1",
      XDG_CONFIG_HOME: configHome,
    };
  },
);

Given(
  "a child process command outputs text through vt-pty",
  function (this: StepWorld) {
    this.nativeCommand = ["--settle-ms", "20", "--", "printf", "hello"];
  },
);

Given(
  "a child process emits virtual placements after the vt-pty settle interval",
  function (this: StepWorld) {
    const program = `
const png = Buffer.alloc(24);
png.set([137, 80, 78, 71]);
png.writeUInt32BE(1, 16);
png.writeUInt32BE(1, 20);
process.stdout.write("start");
setTimeout(() => {
  process.stdout.write(
    "\\x1b_Ga=T,f=100,q=2,U=1,i=1,p=1,c=1,r=1;" +
      png.toString("base64") +
      "\\x1b\\\\",
  );
}, 350);
`;
    this.nativeCommand = [
      "--settle-ms",
      "20",
      "--wait-for-placements",
      "1",
      "--",
      process.execPath,
      "-e",
      program,
    ];
  },
);

function placementFollowedByContinuousOutput(
  waitForPlacements: number,
  tail = "",
  padding = 0,
) {
  const timeout = padding > 0 ? 2000 : 300;
  const program = `
const png = Buffer.alloc(24);
png.set([137, 80, 78, 71]);
png.writeUInt32BE(1, 16);
png.writeUInt32BE(1, 20);
const placement = Buffer.from(
  "\\x1b[?2026h\\x1b_Ga=T,f=100,q=2,U=1,i=1,p=1,c=1,r=1;" +
    png.toString("base64") +
    "\\x1b\\\\",
);
process.stdout.write(Buffer.concat([placement, Buffer.alloc(${padding})]), () => {
  process.stdout.write(${JSON.stringify(`${tail}\x1b[?2026l`)});
  setInterval(() => process.stdout.write("."), 5);
});
`;
  return [
    "--settle-ms",
    String(timeout + 1000),
    "--timeout-ms",
    String(timeout),
    "--wait-for-placements",
    String(waitForPlacements),
    "--wait-for-render-boundary",
    "--",
    process.execPath,
    "-e",
    program,
  ];
}

Given(
  "a child process continues output after the required virtual placements",
  function (this: StepWorld) {
    this.nativeCommand = placementFollowedByContinuousOutput(1);
  },
);

Given(
  "a child process exits abnormally after a virtual placement",
  function (this: StepWorld) {
    const program = `
const png = Buffer.alloc(24);
png.set([137, 80, 78, 71]);
png.writeUInt32BE(1, 16);
png.writeUInt32BE(1, 20);
const output =
  "\\x1b[?2026h\\x1b_Ga=T,f=100,q=2,U=1,i=1,p=1,c=1,r=1;" +
  png.toString("base64") +
  "\\x1b\\\\\\x1b[?2026l";
process.stdout.write(output, () => process.exit(1));
`;
    this.nativeCommand = [
      "--settle-ms",
      "20",
      "--wait-for-placements",
      "1",
      "--wait-for-render-boundary",
      "--wait-for-child-exit",
      "--",
      process.execPath,
      "-e",
      program,
    ];
  },
);

Given(
  "a child process keeps emitting placeholders and body text separately after virtual placements",
  function (this: StepWorld) {
    const placeholder =
      "\x1b[38;2;0;0;1m\x1b[58:2::0:0:1m" +
      `${String.fromCodePoint(0x10eeee)}\u0305\u0305` +
      "\x1b[39;59mafter-placement";
    this.nativeCommand = placementFollowedByContinuousOutput(
      1,
      placeholder,
      65536,
    );
  },
);

Given(
  "a child process continues output after emitting some virtual placements",
  function (this: StepWorld) {
    this.nativeCommand = placementFollowedByContinuousOutput(2);
  },
);

Given(
  "a child process command outputs a long grapheme cluster through vt-pty",
  function (this: StepWorld) {
    this.nativeCommand = [
      "--settle-ms",
      "20",
      "--",
      process.execPath,
      "-e",
      'process.stdout.write("a" + "\\u0301".repeat(32))',
    ];
  },
);

Given(
  "a child process runs beyond the vt-pty deadline",
  function (this: StepWorld) {
    this.nativeEnvironment = {
      ...process.env,
      PI_FORMULA_VT_TOOL: this.vtTool,
    };
    this.entranceArguments = [
      "--timeout-ms",
      "20",
      "--wait-for-placements",
      "1",
      "--",
      process.execPath,
      "-e",
      'process.stdout.write("start"); setTimeout(() => {}, 1000)',
    ];
  },
);

Given(
  "a child process cannot be launched from vt-pty",
  function (this: StepWorld) {
    this.nativeEnvironment = {
      ...process.env,
      PI_FORMULA_VT_TOOL: this.vtTool,
    };
    this.entranceArguments = ["--", "pi-formula-command-that-does-not-exist"];
  },
);

Given("vt-pty returns APC fragments in body cells", function (this: StepWorld) {
  this.nativeTestDirectory = fs.mkdtempSync(
    path.join(os.tmpdir(), "pi-formula-apc-test-"),
  );
  const tool = path.join(this.nativeTestDirectory, "apc-vt-pty");
  const placements = Array.from(
    { length: 7 },
    (_, index) =>
      `placement: image_id=${index} virtual=1 image={1x1 format=100 bytes=4}`,
  ).join("\\n");
  fs.writeFileSync(
    tool,
    `#!/bin/sh\nprintf '%s\\n' '${placements}' 'kitty.placements=7' 'cells.dirty_placeholders=0 cells.apc_leak=1'\n`,
  );
  fs.chmodSync(tool, 0o755);
  this.nativeEnvironment = { ...process.env, PI_FORMULA_VT_TOOL: tool };
});

Given(
  "vt-pty returns a virtual placement without placeholders",
  function (this: StepWorld) {
    this.nativeTestDirectory = fs.mkdtempSync(
      path.join(os.tmpdir(), "pi-formula-missing-placeholder-test-"),
    );
    const tool = path.join(
      this.nativeTestDirectory,
      "missing-placeholder-vt-pty",
    );
    const placements = Array.from(
      { length: 7 },
      (_, index) =>
        `placement: image_id=0x${String(index + 1).padStart(6, "0")} placement_id=0x000001 virtual=1 cols=1 rows=1 z=0 image={1x1 format=1 bytes=4}`,
    ).join("\n");
    fs.writeFileSync(
      tool,
      `#!/bin/sh\nprintf '%s\n' '${placements}' 'kitty.placements=7' 'cells.placeholders=0 cells.underline_not_rgb=0 cells.dirty_placeholders=0 cells.apc_leak=0'\n`,
    );
    fs.chmodSync(tool, 0o755);
    this.nativeEnvironment = { ...process.env, PI_FORMULA_VT_TOOL: tool };
  },
);

Given("vt-pty rendering does not settle", function (this: StepWorld) {
  this.nativeTestDirectory = fs.mkdtempSync(
    path.join(os.tmpdir(), "pi-formula-unsettled-test-"),
  );
  const tool = path.join(this.nativeTestDirectory, "unsettled-vt-pty");
  fs.writeFileSync(
    tool,
    "#!/bin/sh\nprintf 'vt-pty: timeout 15000ms\\n' >&2\nexit 2\n",
  );
  fs.chmodSync(tool, 0o755);
  this.nativeEnvironment = { ...process.env, PI_FORMULA_VT_TOOL: tool };
});

Given("a saved corpus session can be opened in Pi", function (this: StepWorld) {
  this.nativeEnvironment = {
    ...process.env,
    PI_FORMULA_VT_TOOL: this.vtTool,
  };
});

Given(
  "a check renders incomplete and final Pi body text in order",
  function (this: StepWorld) {
    this.nativeEnvironment = {
      ...process.env,
      PI_FORMULA_VT_TOOL: this.vtTool,
    };
  },
);

Given(
  "pi-formula has underline colors reverted to semicolon syntax",
  function (this: StepWorld) {
    this.nativeTestDirectory = fs.mkdtempSync(
      path.join(root, ".pi-formula-dirty-placeholder-test-"),
    );
    const source = path.join(this.nativeTestDirectory, "src");
    fs.cpSync(path.join(root, "src"), source, { recursive: true });
    fs.copyFileSync(
      path.join(root, "package.json"),
      path.join(this.nativeTestDirectory, "package.json"),
    );
    const kittyPath = path.join(source, "kitty.ts");
    const kitty = fs.readFileSync(kittyPath, "utf8");
    fs.writeFileSync(
      kittyPath,
      kitty.replace(/\[58:2::\$\{red\}:\$\{green\}:\$\{blue\}m/u, (value) =>
        value.replace(":2::", ";2;").replaceAll(":", ";"),
      ),
    );
    this.nativeEnvironment = {
      ...process.env,
      PI_FORMULA_VT_TOOL: this.vtTool,
      PI_FORMULA_PROTOCOL_EXTENSION: path.join(source, "extension.ts"),
    };
  },
);

When("run the protocol check entry point", function (this: StepWorld) {
  this.nativeResult = spawnSync(
    process.execPath,
    ["scripts/run-vt-pty.js", ...this.entranceArguments],
    {
      cwd: root,
      encoding: "utf8",
      env: this.nativeEnvironment,
      timeout: 10_000,
    },
  );
});

When("print the libghostty-vt build plan", function (this: StepWorld) {
  this.nativeResult = spawnSync(
    "scripts/build-vt-pty",
    ["--prefix", this.nativeTestDirectory, "--print-plan"],
    { cwd: root, encoding: "utf8", timeout: 10_000 },
  );
  this.buildPlan = Object.fromEntries(
    this.nativeResult.stdout
      .trim()
      .split("\n")
      .map((line) => {
        const separator = line.indexOf("=");
        return [line.slice(0, separator), line.slice(separator + 1)];
      }),
  );
});

function inspectEncoderProtocol(
  world: StepWorld,
  check: string,
  environment = process.env,
) {
  world.nativeResult = spawnSync(
    process.execPath,
    ["scripts/verify-encoder-protocol.js", "--check", check],
    {
      cwd: root,
      encoding: "utf8",
      env: { ...environment, PI_FORMULA_VT_TOOL: world.vtTool },
      timeout: 30_000,
    },
  );
}

When("run the encoder-layer protocol check", function (this: StepWorld) {
  inspectEncoderProtocol(this, "storage", this.nativeEnvironment);
});

When("check encoder-layer storage", function (this: StepWorld) {
  inspectEncoderProtocol(this, "storage");
});

When(
  "run the documented encoder-layer check entry point",
  function (this: StepWorld) {
    this.nativeResult = spawnSync(
      "npm",
      ["run", "verify:encoder-protocol", "--", "--check", "storage"],
      {
        cwd: this.nativeTestDirectory,
        encoding: "utf8",
        env: this.encoderEnvironment ?? {
          ...process.env,
          PI_FORMULA_VT_TOOL: this.vtTool,
        },
        timeout: 30_000,
      },
    );
  },
);

When("check encoder-layer virtual placements", function (this: StepWorld) {
  inspectEncoderProtocol(this, "placement");
});

When("check encoder-layer placeholder image IDs", function (this: StepWorld) {
  inspectEncoderProtocol(this, "image-id");
});

When("check encoder-layer placeholder coordinates", function (this: StepWorld) {
  inspectEncoderProtocol(this, "coordinates");
});

When(
  "check encoder-layer placeholder underline color tags",
  function (this: StepWorld) {
    inspectEncoderProtocol(this, "underline");
  },
);

When(
  "check the second encoder output for the same Markdown",
  function (this: StepWorld) {
    inspectEncoderProtocol(this, "cached");
  },
);

When(
  "check encoder output with image transfers omitted",
  function (this: StepWorld) {
    inspectEncoderProtocol(this, "missing-transfer");
  },
);

When("wait for child process output to settle", function (this: StepWorld) {
  this.nativeResult = spawnSync(this.vtTool, this.nativeCommand, {
    cwd: root,
    encoding: "utf8",
    timeout: 10_000,
  });
});

When("run the protocol check through Pi", function (this: StepWorld) {
  this.nativeResult = spawnSync(
    process.execPath,
    ["scripts/verify-pi-protocol.js"],
    {
      cwd: root,
      encoding: "utf8",
      env: this.nativeEnvironment,
      timeout: 30_000,
    },
  );
});

When("run the streaming protocol check", function (this: StepWorld) {
  this.nativeResult = spawnSync(
    process.execPath,
    ["scripts/verify-streaming-protocol.js"],
    {
      cwd: root,
      encoding: "utf8",
      env: this.nativeEnvironment,
      timeout: 30_000,
    },
  );
});

Then("The protocol check succeeds without vt-pty", function (this: StepWorld) {
  assert.deepEqual(this.nativeResult.status, 0);
});

Then(
  "The protocol check reports a skip because vt-pty is unavailable",
  function (this: StepWorld) {
    assert.deepEqual(
      this.nativeResult.stdout,
      "SKIP: libghostty-vt protocol check (vt-pty not found)\n",
    );
  },
);

Then(
  "The Pi protocol check succeeds without vt-pty",
  function (this: StepWorld) {
    assert.deepEqual(this.nativeResult.status, 0);
  },
);

Then(
  "The Pi protocol check reports a skip because vt-pty is unavailable",
  function (this: StepWorld) {
    assert.deepEqual(
      this.nativeResult.stdout,
      "SKIP: protocol check through Pi (vt-pty not found)\n",
    );
  },
);

Then("The streaming check succeeds without vt-pty", function (this: StepWorld) {
  assert.deepEqual(this.nativeResult.status, 0);
});

Then(
  "The streaming check reports a skip because vt-pty is unavailable",
  function (this: StepWorld) {
    assert.deepEqual(
      this.nativeResult.stdout,
      "SKIP: streaming protocol check (vt-pty not found)\n",
    );
  },
);

Then(
  "Multiple frames are reported as checked in chronological order",
  function (this: StepWorld) {
    assert.equal(
      /streaming-protocol: frames=([2-9]|[1-9][0-9]+)/u.test(
        this.nativeResult.stdout,
      ),
      true,
      this.nativeResult.stderr || this.nativeResult.stdout,
    );
  },
);

Then(
  "Three differential renders preserving preceding tool output are reported",
  function (this: StepWorld) {
    assert.equal(
      this.nativeResult.stdout.includes(
        "streaming-protocol: streaming_updates=3 preceding_tool=preserved full_clears=0",
      ),
      true,
      this.nativeResult.stderr || this.nativeResult.stdout,
    );
  },
);

Then(
  "Each completed frame reports matching virtual placement and placeholder image IDs",
  function (this: StepWorld) {
    assert.equal(
      /streaming-protocol: complete_frames=\d+ placement_placeholders=matched/u.test(
        this.nativeResult.stdout,
      ),
      true,
      this.nativeResult.stderr || this.nativeResult.stdout,
    );
  },
);

Then(
  "No intermediate frame is reported as having APC fragments",
  function (this: StepWorld) {
    assert.equal(
      this.nativeResult.stdout.includes("streaming-protocol: apc_leak=0"),
      true,
      this.nativeResult.stderr || this.nativeResult.stdout,
    );
  },
);

Then(
  "The final frame display formula and virtual placement counts match",
  function (this: StepWorld) {
    assert.equal(
      /streaming-protocol: final display_formulas=(\d+) virtual_images=\1/u.test(
        this.nativeResult.stdout,
      ),
      true,
      this.nativeResult.stderr || this.nativeResult.stdout,
    );
  },
);

Then(
  "The vt-pty specified by the environment variable succeeds",
  function (this: StepWorld) {
    assert.deepEqual(this.nativeResult.status, 0);
  },
);

Then(
  "The output of the vt-pty specified by the environment variable is returned",
  function (this: StepWorld) {
    assert.deepEqual(this.nativeResult.stdout, "selected vt-pty\n");
  },
);

Then("The encoder check succeeds without vt-pty", function (this: StepWorld) {
  assert.deepEqual(this.nativeResult.status, 0);
});

Then(
  "The encoder check reports a skip because vt-pty is unavailable",
  function (this: StepWorld) {
    assert.deepEqual(
      this.nativeResult.stdout,
      "SKIP: encoder protocol check (vt-pty not found)\n",
    );
  },
);

Then(
  "Storage contains one PNG image matching the plan",
  function (this: StepWorld) {
    assert.equal(
      this.nativeResult.stdout,
      "encoder-protocol: storage ok\n",
      this.nativeResult.stderr,
    );
  },
);

Then(
  "The isolated encoder storage check is reported",
  function (this: StepWorld) {
    assert.equal(
      this.nativeResult.stdout.includes("encoder-protocol: storage ok"),
      true,
      this.nativeResult.stderr || this.nativeResult.stdout,
    );
  },
);

Then(
  "Virtual placement columns and rows match the plan",
  function (this: StepWorld) {
    assert.equal(
      this.nativeResult.stdout,
      "encoder-protocol: placement ok\n",
      this.nativeResult.stderr,
    );
  },
);

Then(
  "The image ID decoded from foreground RGB matches the plan",
  function (this: StepWorld) {
    assert.equal(
      this.nativeResult.stdout,
      "encoder-protocol: image-id ok\n",
      this.nativeResult.stderr,
    );
  },
);

Then(
  "Coordinates decoded from diacritics have no gaps or extras",
  function (this: StepWorld) {
    assert.equal(
      this.nativeResult.stdout,
      "encoder-protocol: coordinates ok\n",
      this.nativeResult.stderr,
    );
  },
);

Then(
  "All placeholder cell underline color tags are RGB",
  function (this: StepWorld) {
    assert.equal(
      this.nativeResult.stdout,
      "encoder-protocol: underline ok\n",
      this.nativeResult.stderr,
    );
  },
);

Then(
  "Storage contains the image on the second pass too",
  function (this: StepWorld) {
    assert.equal(
      this.nativeResult.stdout,
      "encoder-protocol: cached ok\n",
      this.nativeResult.stderr,
    );
  },
);

Then(
  "The encoder output check without image transfers returns exit code 1",
  function (this: StepWorld) {
    assert.deepEqual(this.nativeResult.status, 1);
  },
);

Then(
  "The encoder check reports that the placeholder ID has no virtual placement",
  function (this: StepWorld) {
    assert.deepEqual(
      this.nativeResult.stderr.trim(),
      "No virtual placement for the ID referenced by a placeholder",
    );
  },
);

Then("The libghostty-vt build plan succeeds", function (this: StepWorld) {
  assert.deepEqual(this.nativeResult.status, 0);
});

Then(
  "The libghostty-vt build plan uses the pinned commit",
  function (this: StepWorld) {
    assert.deepEqual(
      this.buildPlan.pin,
      "349f026087d948f8f898dca3231ff91438f83ab8",
    );
  },
);

Then(
  "The libghostty-vt build plan uses the specified prefix",
  function (this: StepWorld) {
    assert.deepEqual(this.buildPlan.prefix, this.nativeTestDirectory);
  },
);

Then(
  "The build plan header is under include in the specified prefix",
  function (this: StepWorld) {
    assert.deepEqual(
      this.buildPlan.include,
      path.join(this.nativeTestDirectory, "include"),
    );
  },
);

Then(
  "The build plan library is under lib in the specified prefix",
  function (this: StepWorld) {
    assert.deepEqual(
      this.buildPlan.library,
      path.join(this.nativeTestDirectory, "lib"),
    );
  },
);

Then(
  "The build plan vt-pty is under bin in the specified prefix",
  function (this: StepWorld) {
    assert.deepEqual(
      this.buildPlan["vt-tool"],
      path.join(this.nativeTestDirectory, "bin/vt-pty"),
    );
  },
);

Then(
  "The Zig build command uses only the specified prefix",
  function (this: StepWorld) {
    assert.deepEqual(
      this.buildPlan["zig-command"],
      "zig build -Demit-lib-vt -Doptimize=ReleaseFast -Dcpu=baseline --prefix " +
        this.nativeTestDirectory,
    );
  },
);

Then("The protocol body cells report hello", function (this: StepWorld) {
  assert.equal(
    this.nativeResult.stdout.includes('row[0]: placeholders=0 "hello"'),
    true,
    this.nativeResult.stderr || this.nativeResult.stdout,
  );
});

Then(
  "Protocol state is printed after receiving the required virtual placements",
  function (this: StepWorld) {
    assert.equal(
      this.nativeResult.stdout.includes("kitty.placements=1"),
      true,
      this.nativeResult.stderr || this.nativeResult.stdout,
    );
  },
);

Then(
  "Protocol state is printed without waiting for output to settle",
  function (this: StepWorld) {
    assert.equal(
      this.nativeResult.stdout.includes("kitty.placements=1"),
      true,
      this.nativeResult.stderr || this.nativeResult.stdout,
    );
  },
);

Then(
  "The image IDs and coordinates of delayed placeholders are reported",
  function (this: StepWorld) {
    assert.equal(
      this.nativeResult.stdout.includes(
        "placeholder: image_id=0x000001 row=0 col=0",
      ),
      true,
      this.nativeResult.stderr || this.nativeResult.stdout,
    );
  },
);

Then(
  "The virtual placement count at timeout is printed",
  function (this: StepWorld) {
    assert.equal(
      this.nativeResult.stderr.includes(
        "waiting for 2 placements (observed 1)",
      ),
      true,
      this.nativeResult.stderr || this.nativeResult.stdout,
    );
  },
);

Then(
  "The long grapheme cluster body cells report a",
  function (this: StepWorld) {
    assert.equal(
      this.nativeResult.stdout.includes('row[0]: placeholders=0 "a"'),
      true,
      this.nativeResult.stderr || this.nativeResult.stdout,
    );
  },
);

Then("A timeout is not treated as success", function (this: StepWorld) {
  assert.equal(
    this.nativeResult.stderr.includes("waiting for 1 placements (observed 0)"),
    true,
    this.nativeResult.stderr || this.nativeResult.stdout,
  );
});

Then(
  "A child process launch failure is not treated as success",
  function (this: StepWorld) {
    assert.equal(
      this.nativeResult.stderr.includes("child exited with status 127"),
      true,
      this.nativeResult.stderr || this.nativeResult.stdout,
    );
  },
);

Then(
  "The check fails on APC fragments in body cells",
  function (this: StepWorld) {
    assert.equal(
      /APC fragments in body cells through Pi/u.test(this.nativeResult.stderr),
      true,
      this.nativeResult.stderr || this.nativeResult.stdout,
    );
  },
);

Then(
  "The check fails on missing placeholders for virtual placements",
  function (this: StepWorld) {
    assert.equal(
      this.nativeResult.stderr.includes("No placeholder for virtual placement"),
      true,
      this.nativeResult.stderr || this.nativeResult.stdout,
    );
  },
);

Then(
  "The unsettled Pi protocol check returns exit code 2",
  function (this: StepWorld) {
    assert.deepEqual(this.nativeResult.status, 2);
  },
);

Then(
  "The Pi protocol check reports the render timeout reason",
  function (this: StepWorld) {
    assert.deepEqual(
      this.nativeResult.stderr.trim(),
      "vt-pty: timeout 15000ms",
    );
  },
);

Then("Placeholder cells are reported as clean", function (this: StepWorld) {
  assert.equal(
    this.nativeResult.stdout.includes("cells.dirty_placeholders=0"),
    true,
    this.nativeResult.stderr || this.nativeResult.stdout,
  );
});

Then(
  "Body cells are reported as having no APC fragments",
  function (this: StepWorld) {
    assert.equal(
      this.nativeResult.stdout.includes("cells.apc_leak=0"),
      true,
      this.nativeResult.stderr || this.nativeResult.stdout,
    );
  },
);

Then(
  "Display formula and storage-backed virtual placement counts match",
  function (this: StepWorld) {
    assert.equal(
      /pi-protocol: display_formulas=(\d+) virtual_images=\1/u.test(
        this.nativeResult.stdout,
      ),
      true,
      this.nativeResult.stderr || this.nativeResult.stdout,
    );
  },
);

Then("The check fails on dirty placeholder cells", function (this: StepWorld) {
  assert.equal(
    /Dirty placeholder cells through Pi/u.test(this.nativeResult.stderr),
    true,
    this.nativeResult.stderr || this.nativeResult.stdout,
  );
});

Then(
  "The protocol check exit code is {int}",
  function (this: StepWorld, expected: number) {
    assert.equal(
      this.nativeResult.status,
      expected,
      this.nativeResult.stderr || this.nativeResult.stdout,
    );
  },
);

Then("The protocol check exit code is nonzero", function (this: StepWorld) {
  assert.notEqual(
    this.nativeResult.status,
    0,
    this.nativeResult.stderr || this.nativeResult.stdout,
  );
});

Then(
  "Extension build artifacts are created in the isolated checkout",
  function (this: StepWorld) {
    assert.equal(
      fs.existsSync(path.join(this.nativeTestDirectory, "dist/extension.js")),
      true,
      this.nativeResult.stderr || this.nativeResult.stdout,
    );
  },
);

Then("The protocol reports zero image placements", function (this: StepWorld) {
  assert.equal(
    this.nativeResult.stdout.includes("kitty.placements=0"),
    true,
    this.nativeResult.stderr || this.nativeResult.stdout,
  );
});

Then("The protocol reports zero APC leaks", function (this: StepWorld) {
  assert.equal(
    this.nativeResult.stdout.includes("cells.apc_leak=0"),
    true,
    this.nativeResult.stderr || this.nativeResult.stdout,
  );
});

Then(
  "The after-placement body text following a virtual placement is reported",
  function (this: StepWorld) {
    assert.equal(
      this.nativeResult.stdout.includes("after-placement"),
      true,
      this.nativeResult.stderr || this.nativeResult.stdout,
    );
  },
);

Then(
  "The long grapheme cluster reports zero APC leaks",
  function (this: StepWorld) {
    assert.equal(
      this.nativeResult.stdout.includes("cells.apc_leak=0"),
      true,
      this.nativeResult.stderr || this.nativeResult.stdout,
    );
  },
);

function terminalColorQuery(osc: number) {
  const program = `
process.stdin.setRawMode(true);
process.stdin.setEncoding("utf8");
let response = "";
const timeout = setTimeout(() => process.exit(1), 1000);
process.stdin.on("data", (data) => {
  response += data;
  if (!response.includes("\\x1b\\\\")) return;
  clearTimeout(timeout);
  process.stdout.write("terminal-color=" + JSON.stringify(response));
  process.stdin.pause();
});
process.stdout.write("\\x1b]${osc};?\\x1b\\\\");
`;
  return [
    "--settle-ms",
    "20",
    "--wait-for-child-exit",
    "--",
    process.execPath,
    "-e",
    program,
  ];
}

Given(
  "a child process queries the vt-pty default foreground color",
  function (this: StepWorld) {
    this.nativeCommand = terminalColorQuery(10);
  },
);

Given(
  "a child process queries the vt-pty default background color",
  function (this: StepWorld) {
    this.nativeCommand = terminalColorQuery(11);
  },
);

Then(
  "The child process receives the default foreground color response",
  function (this: StepWorld) {
    assert.match(this.nativeResult.stdout, /10;rgb:d8d8\/d8d8\/d8d8/u);
  },
);

Then(
  "The child process receives the default background color response",
  function (this: StepWorld) {
    assert.match(this.nativeResult.stdout, /11;rgb:2828\/2c2c\/3434/u);
  },
);
