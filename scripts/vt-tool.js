const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const pinFile = path.join(root, "native/libghostty-vt.commit");

function isExecutable(file) {
  try {
    if (!fs.statSync(file).isFile()) return false;
    fs.accessSync(file, fs.constants.X_OK);
    return true;
  } catch {
    return false;
  }
}

function pinnedCommit() {
  const pin = fs.readFileSync(pinFile, "utf8").trim();
  if (!/^[0-9a-f]{40}$/u.test(pin)) {
    throw new Error(`${pinFile} must contain one full commit hash`);
  }
  return pin;
}

function defaultVtTool(environment = process.env) {
  const home = environment.HOME || os.homedir();
  const cache = environment.XDG_CACHE_HOME || path.join(home, ".cache");
  return path.join(
    cache,
    "pi-formula/libghostty-vt",
    pinnedCommit(),
    "prefix/bin/vt-pty",
  );
}

function resolveVtTool(environment = process.env) {
  const candidates = [
    environment.PI_FORMULA_VT_TOOL,
    defaultVtTool(environment),
  ];
  return candidates.find((candidate) => candidate && isExecutable(candidate));
}

module.exports = { resolveVtTool };
