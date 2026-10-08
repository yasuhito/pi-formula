const formula: typeof import("../../dist/api.js") = require("../..");

const additionalMacros = {
  trial: ["\\left|#1\\right\\rangle", 1] as const,
};

function integrationExtension(
  api: typeof import("../../dist/api.js"),
  pi: import("@earendil-works/pi-coding-agent").ExtensionAPI,
) {
  api.registerFormula(pi, additionalMacros);
  return {
    createPng(latex: string, availableWidth = 80) {
      return api.createFormulaPng(latex, availableWidth);
    },
  };
}

function registerIntegrationExtension(
  pi: import("@earendil-works/pi-coding-agent").ExtensionAPI,
) {
  return integrationExtension(formula, pi);
}

function loadIntegrationExtension() {
  const apiPath = require.resolve("../..");
  delete require.cache[apiPath];
  const api: typeof import("../../dist/api.js") = require(apiPath);
  return {
    register(pi: import("@earendil-works/pi-coding-agent").ExtensionAPI) {
      return integrationExtension(api, pi);
    },
    formula: api,
  };
}

export {
  additionalMacros,
  loadIntegrationExtension,
  registerIntegrationExtension,
};
