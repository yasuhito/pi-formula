"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolveVtTool = resolveVtTool;
const node_fs_1 = __importDefault(require("node:fs"));
const node_os_1 = __importDefault(require("node:os"));
const node_path_1 = __importDefault(require("node:path"));
const root = node_path_1.default.resolve(__dirname, "..");
const pinFile = node_path_1.default.join(root, "native/libghostty-vt.commit");
function isExecutable(file) {
    try {
        if (!node_fs_1.default.statSync(file).isFile())
            return false;
        node_fs_1.default.accessSync(file, node_fs_1.default.constants.X_OK);
        return true;
    }
    catch {
        return false;
    }
}
function pinnedCommit() {
    const pin = node_fs_1.default.readFileSync(pinFile, "utf8").trim();
    if (!/^[0-9a-f]{40}$/u.test(pin)) {
        throw new Error(`${pinFile} must contain one full commit hash`);
    }
    return pin;
}
function defaultVtTool(environment = process.env) {
    const home = environment.HOME || node_os_1.default.homedir();
    const cache = environment.XDG_CACHE_HOME || node_path_1.default.join(home, ".cache");
    return node_path_1.default.join(cache, "pi-formula/libghostty-vt", pinnedCommit(), "prefix/bin/vt-pty");
}
function resolveVtTool(environment = process.env) {
    const candidates = [
        environment.PI_FORMULA_VT_TOOL,
        defaultVtTool(environment),
    ];
    return candidates.find((candidate) => Boolean(candidate && isExecutable(candidate)));
}
//# sourceMappingURL=vt-tool.js.map