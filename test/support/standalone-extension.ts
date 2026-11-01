function loadStandaloneExtension() {
  const apiPath = require.resolve("../..");
  const extensionPath = require.resolve("../../dist/extension.js");
  delete require.cache[apiPath];
  delete require.cache[extensionPath];
  const register: typeof import("../../dist/extension.js").default =
    require(extensionPath).default;
  const formula: typeof import("../../dist/api.js") = require(apiPath);
  return { register, formula };
}

export { loadStandaloneExtension };
