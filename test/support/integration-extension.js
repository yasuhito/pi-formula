const formula = require("../..");

const additionalMacros = {
  trial: ["\\left|#1\\right\\rangle", 1],
};

function integrationExtension(api, pi) {
  api.registerFormula(pi, additionalMacros);
  return {
    createPng(latex, availableWidth = 80) {
      return api.createFormulaPng(latex, availableWidth);
    },
  };
}

function registerIntegrationExtension(pi) {
  return integrationExtension(formula, pi);
}

function loadIntegrationExtension() {
  const apiPath = require.resolve("../..");
  delete require.cache[apiPath];
  const api = require(apiPath);
  return {
    register(pi) {
      return integrationExtension(api, pi);
    },
    formula: api,
  };
}

module.exports = {
  additionalMacros,
  loadIntegrationExtension,
  registerIntegrationExtension,
};
